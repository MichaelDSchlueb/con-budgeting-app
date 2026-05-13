import React, { useState, useMemo, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'
import {BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend} from 'recharts';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { useAuth as useOIDCAuth } from "react-oidc-context";
import { saveToOfflineQueue, getPendingReceipts, removeFromQueue } from './assets/utils/db';
import {useAuthenticator as useAmplifyAuth} from '@aws-amplify/ui-react';

function LandingPage() {
  const auth = useOIDCAuth();
  //console.log("Auth state in LandingPage:", auth);

  const signOutRedirect = () => {
    const clientId = "5d32h4mt57n9ljti8d8fhkcflt";
    const logoutUri = "https://main.dymkwrcw8goz2.amplifyapp.com/";
    const cognitoDomain = "https://main.dymkwrcw8goz2.amplifyapp.com/";
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  };

  if (auth.isLoading) {
    return <div>Loading...</div>;
  }

  if (auth.error) {
    return <div>Encountering error... {auth.error.message}</div>;
  }

  if (auth.isAuthenticated) {
    console.log("Full Auth Object:", auth);
  // Bypass the Dashboard component temporarily to see if the screen stays white
  return <Dashboard auth={auth} SignOut={signOutRedirect} />;
  }

  return (
    <div>
      <h1>Welcome to ConGreen!</h1>
      <p>Please sign in to view your dashboard.</p>
      <button onClick={() => auth.signinRedirect()}>Sign in</button>
    </div>
  );
}

function Dashboard ({auth, SignOut}) {
  const [count, setCount] = useState(0)
  const [totalBudget, setTotalBudget] = useState(0);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState('category'); // New state for grouping
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const user = auth?.user;
  const signOut = SignOut;
  const profile = user.profile
  const [nextCon, setNextCon] = useState(""); // blank string until we fetch it from the API
  console.log(profile['sub'])
  const uploadToS3 = async (file) => {
  try {
    // STEP 1: Get a Pre-signed URL from your Lambda/API Gateway
    // Replace this URL with your actual endpoint
    const response = await fetch('https://p1hs04nmxa.execute-api.us-east-2.amazonaws.com/cg-prod/uploads', {
      method: 'POST',
      body: JSON.stringify({
        fileName: `receipt_${Date.now()}.jpg`,
        fileType: file.type,
        user_sub: profile['sub']
      }),
      headers: {
        'Content-Type': 'application/json',
        // 'Authorization': `Bearer ${token}` // Add this once Cognito is fully wired
      }
    });

    const { uploadURL } = await response.json();

    // STEP 2: Use that URL to push the binary data to S3
    const uploadResult = await fetch(uploadURL, {
      method: 'PUT',
      body: file, // The raw Blob from IndexedDB
      headers: {
        'Content-Type': file.type // Adjust if you support more types
      }
    });

    if (uploadResult.ok) {
      console.log("File uploaded successfully to S3.");
    } else {
      const errorText = await uploadResult.text();
      console.error("S3 rejected the file:", errorText);
    }

    console.log("Mission-Critical: File safely in S3 bucket.");
    return true;
  } catch (err) {
    console.error("Pipeline Error:", err);
    throw err; // Re-throw so the 'drain' loop knows NOT to delete from outbox
  }
};

  const handleAutoSync = async () => {
  console.log("Attempting to drain outbox...");
  const pending = await getPendingReceipts();
  
  if (pending.length === 0) {
    console.log("Outbox is already empty.");
    return;
  }

  for (const item of pending) {
    try {
      console.log(`Uploading item ${item.id} to S3...`);
      
      // STOP: If you don't have S3 logic yet, comment this out to test the loop:
      await uploadToS3(item.file); 
      
      console.log(`Upload successful for ${item.id}. Removing from local DB...`);
      await removeFromQueue(item.id);
    } catch (err) {
      console.error("Critical Sync Error for item " + item.id, err);
      // We break here so we don't spam the server if it's down
      break; 
    }
  }
  refreshPendingCount();
};

  const refreshPendingCount = async () => {
    const pending = await getPendingReceipts();
    setPendingCount(pending.length);
  };

  useEffect(() => {
    refreshPendingCount();
    window.addEventListener('online', refreshPendingCount);
    return () => window.removeEventListener('online', refreshPendingCount);

    const syncOutbox = async () => {
  if (navigator.onLine) {
    const pending = await getPendingReceipts(); // Now imported!
    for (const receipt of pending) {
      try {
        // This is where it hits your S3 -> SQS -> Lambda pipeline
        await uploadToS3(receipt.file); 
        await removeFromQueue(receipt.id); // Cleanup local PII
        console.log("Mission-Critical Sync: Receipt uploaded successfully.");
      } catch (err) {
        console.error("Sync failed for this item, keeping in outbox.", err);
      }
    }
    refreshPendingCount(); // Update your new UI badge
  }
};
  }, []);

  useEffect(() => {
    const handleStatus = () => setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []); 

  const userID = (user) => {
    if (!user) return "Unknown_User";
    
  }
  
  const handleReceiptSubmit = async (file) => {
    console.log("File detected:", file); // If this is undefined, the input isn't working
    if (!file) return;
    const metadata = { 
      user_sub: profile['sub'], 
      category: 'General',
      timestamp: new Date().toISOString() 
    }; 

    if (navigator.onLine) {
      try {
        // Your S3 upload logic here
        await uploadToS3(file);
      } catch (err) {
        // If upload fails even while online, fallback to queue
        await saveToOfflineQueue(file, metadata);
      }
    } else {
      // Mission-Critical Offline Mode for MomoCon floor
      await saveToOfflineQueue(file, metadata);
      alert("Receipt saved locally! It will sync when you're back online.");
    }
  }; 
  // Ensure your Dashboard uses the auth data to fetch your purchases
  useEffect(() => {
  // Use 'user' from your useAuthenticator hook instead
  if (user) {
    // Note: In Amplify v6, tokens are fetched via fetchAuthSession()
    // but for a simple UI check, 'user' is enough to trigger the fetch
    fetch(`https://p1hs04nmxa.execute-api.us-east-2.amazonaws.com/cg-prod/purchases?user_stub=${profile['sub']}&con_name=MomoCon-2026`)
      .then(res => res.json())
      .then(data => {
        //console.log("RAW API DATA after call 1", data);
        setPurchases(data);
      });
  }
}, [user]); // Trigger when the user logs in */
  
useEffect(() => {
  // Try to sync immediately when the dashboard loads
  if (navigator.onLine) {
    console.log("Dashboard loaded & online. Forcing sync...");
    handleAutoSync(); 
  }
}, []);
// Function to save a pending receipt locally
const queueReceipt = (receiptData) => {
  // 1. Get the existing queue or create a new one
  const existingQueue = JSON.parse(localStorage.getItem('congreen_queue') || '[]');
  
  // 2. Add the new receipt with a 'pending' status
  const newEntry = {
    ...receiptData,
    id: Date.now(),
    status: 'pending',
    timestamp: new Date().toISOString()
  };
  
  // 3. Save back to local storage
  localStorage.setItem('congreen_queue', JSON.stringify([...existingQueue, newEntry]));
  console.log("Receipt queued for sync!");
}; 
  // 2. DERIVED DATA (useMemo): These can only be calculated AFTER the state above exists
  const currentSpend = useMemo(() => {
    //console.log("Calculating current spend from purchases:", purchases);
    return purchases.reduce((total, item) => total + (parseFloat(item.price_number) || 0), 0);
  }, [purchases]);

  const percentUsed = (currentSpend / totalBudget) * 100;

  const DonutGauge = ({ percent }) => {
  const radius = 70;
  const circumference = 2 * Math.PI * radius; // $2 \pi r$
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <div className="donut-container">
      <svg width="180" height="180" viewBox="0 0 180 180">
        {/* Background Circle (The Track) */}
        <circle
          cx="90" cy="90" r={radius}
          fill="transparent"
          stroke="#161b22"
          strokeWidth="15"
        />
        {/* Foreground Circle (The Fill) */}
        <circle
          cx="90" cy="90" r={radius}
          fill="transparent"
          stroke={percent > 100 ? "red" : percent >= 80 ? "#FFB7C5" : "#A8E6CF"}
          strokeWidth="15"
          strokeDasharray={circumference}
          style={{ 
            strokeDashoffset, 
            transition: 'stroke-dashoffset 0.5s ease',
            strokeLinecap: 'round' 
          }}
          transform="rotate(-90 90 90)" // Starts the bar at the top
        />
        {/* Text in the middle */}
        <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fill="#FFB7C5" fontSize="20">
          {Math.round(percent)}%
        </text>
      </svg>
    </div>
  );
};
/*
const [purchases, setPurchases] = useState([
  { id: 1, item: 'Badge', amount: 50, category: 'Convention', date: '2026-05-21' },
  { id: 2, item: 'Room Total', amount: 30, category: 'Hotel', date: '2026-05-21' },
  { id: 3, item: 'Cosplay Prop', amount: 30, category: 'Art/Vend', date: '2026-05-21' },
  { id: 4, item: 'Authograph', amount: 30, category: 'Guests', date: '2026-05-21' },
  { id: 5, item: 'Food', amount: 30, category: 'Food', date: '2026-05-21' },
  { id: 6, item: 'Taxi', amount: 30, category: 'Transport', date: '2026-05-21' },
  { id: 7, item: 'Special Event', amount: 70, category: 'Convention', date: '2026-05-21' },
  { id: 8, item: 'PS1', amount: 120, category: 'Art/Vend', date: '2026-05-21' },
  // ...
]);
*/

useEffect(() => {
  fetch(`https://p1hs04nmxa.execute-api.us-east-2.amazonaws.com/cg-prod/user_id?user_sub=${profile['sub']}`)
  .then(response => response.json())
  .then(data => {
    setTotalBudget(data['0'].budget); // Adjust based on actual API response structure
    setNextCon(data['0'].next_con);
  })
});

useEffect(() => {
  fetch(`https://p1hs04nmxa.execute-api.us-east-2.amazonaws.com/cg-prod/purchases?user_stub=${profile['sub']}&con_name=MomoCon-2026`)
      .then(response => response.json())
      .then(data => {
      //console.log("RAW API DATA after call 2", data)
        setPurchases(data); // Assuming the API returns a JSON string in the body
        setLoading(false);
      })
    .catch(err => console.error('Error fetching purchases:', err));
  }, []);


const categoryCodeMap = {
  'Food': 'FD',
  'Hotel': 'HTL',
  'Art/Vend': 'AV',
  'Guests': 'GST',
  'Uncategorized': 'UNK',
  'Convention': 'CVN',
  'Transportation': 'TRN',
  // Add more mappings as needed
};

// A conceptual look at the drain logic
const drainOutbox = async () => {
  const pending = await getPendingReceipts();
  console.log(`MomoCon Sync: Found ${pending.length} receipts to upload.`);

  for (const item of pending) {
    try {
      // 1. Send to your AWS S3 Ingestion Bucket
      await uploadToS3(item.file); 
      
      // 2. ONLY if S3 confirms receipt, delete local copy
      await removeFromQueue(item.id); 
      
      console.log(`Sync complete for receipt #${item.id}`);
    } catch (err) {
      console.error("Cloud upload failed, keeping file local for retry.", err);
    }
  }
  refreshPendingCount(); // Update your UI badge to '0'
};

// The helper function to get the code
const getCategoryCode = (category) => categoryCodeMap[category] || '??';

const groupedPurchases = useMemo(() => {
  if (!purchases || !Array.isArray(purchases)) return {};

  return purchases.reduce((groups, item) => {
    // Dynamically select the key based on the 'groupBy' state
    const key = item[groupBy] || 'Uncategorized';
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {});
}, [purchases, groupBy]); // Make sure groupBy is in this dependency array!

// 2. Safe Array Transformation for Recharts
const chartData = useMemo(() => {
  if (!groupedPurchases) return [];

  return Object.entries(groupedPurchases).map(([name, items]) => {
    //console.log(`Processing group: ${name} with items:`, items);
    const total = items.reduce((sum, item) => {
      // 2. Ensure amount is a number, even if it comes in as a string
      const amount = parseFloat(item.price_number) || 0;
      return sum + amount;
    }, 0);

    return {
      name: name,
      code: getCategoryCode(name),
      total: total
    };
  });
}, [groupedPurchases]);

// Destructure groupedData, groupBy, and setGroupBy from props
const PurchaseList = ({ groupedData, groupBy, setGroupBy }) => (
  <div className="purchases-list-content" style={{  
    padding: '20px', 
    maxHeight: '300px', 
    overflowY: 'auto',
    borderRadius: '8px' 
  }}>

    {Object.entries(groupedData).map(([key, items]) => (
      <div key={key} style={{ marginBottom: '15px' }}>
        <div style={{ padding: 0 }}>
          {items.map(p => (
            <div key={p.id} style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              padding: '8px 0', 
              borderBottom: '1px solid #30363d' 
            }}>
              <span>{key}</span>
              <span>{p.item_name}</span>
              <span>${p.price_number}</span>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

  return (
    <>
      <div style={{ textAlign: 'center', marginTop: '50px', fontFamily: 'sans-serif'}}>
        <h1>ConGreen</h1>
        <h2>Good afternoon, {profile['cognito:username']}!</h2>
        <button onClick={signOut}>Sign out</button>
        { nextCon && (
          <h3>Welcome to {nextCon}</h3>
        )}
        {/* 
        <form action="url to lambda" method="POST">
          <input type="con_name" name="receipt" accept="image/*" capture="environment" />
          <button type="submit">Upload Receipt</button>
        </form>
        */}
        <div className="dashboard-root"style={{ padding: '23px', border: '1px solid #646cff', borderRadius: '8px', display: 'inline-block'}}>
          <nav>
            <ul>
              <li>This con</li>
              <li>Per-day view</li>
              <li>Compare with previous cons</li>
            </ul>
          </nav>
          <div className="dashboard-main">
            <div id="Donut" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {nextCon && totalBudget > 0 && (
              <div id="DonutGuage" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <DonutGauge percent={percentUsed} />
                <p>Spending: ${currentSpend} / ${totalBudget}</p>
              </div>
              )}
            </div>
            <div style={{ width: '100%', height: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="code" tickLine={false} axisLine={false} />
              <YAxis hide={false} />
              <Tooltip cursor={{fill: 'transparent'}} />
              <Legend
                content={() => (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', fontSize: '12px'}}>
                    {chartData.map((entry, index) => (
                      // Use the index as a fallback key if the category name/code isn't unique
                      <span key={`legend-${entry.code}-${index}`}>
                        <strong>{entry.code}</strong>: {entry.name}&nbsp;&nbsp;&nbsp;&nbsp;
                      </span>
                    ))}
                  </div>
                )}
              />
              <Bar dataKey="total" fill="#A8E6CF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="upload-section">
  {/*<label className="upload-button">
    {isOffline ? "📸 Save Receipt (Offline)" : "🚀 Upload Receipt"}
    <input 
      type="file" 
      accept="image/*" 
      capture="environment" // This opens the camera directly on mobile!
      onChange={(e) => {
        if (e.target.files && e.target.files[0]) {
          handleReceiptSubmit(e.target.files[0]);
    }
  }}
      style={{ display: 'none' }} 
    />
  </label> */}
  
  
  {pendingCount > 0 && (
    <div className="sync-status">
      {pendingCount} waiting to sync...
    </div>
  )}
</div>
            </div>
            <div id="recommendations">
              <h2>Recommendations</h2>
              <p>Coming soon, AI insights with Joao</p>
            </div>
          </div>
        </div>
        <div id="add-button" style={{ marginTop: '20px' }}>
          {/*<button id="add-button" onClick={() => handleSpend(10)} style={{marginRight: '10px'}}>
            Add a new purchase
          </button>*/}
         <label id="add-button" className="upload-button" style={{ marginTop: '20px' }}>
    {isOffline ? "📸 Save Receipt (Offline)" : "🚀 Upload Receipt"}
    <input 
      type="file" 
      accept="image/*" 
      capture="environment" // This opens the camera directly on mobile!
      onChange={(e) => {
        if (e.target.files && e.target.files[0]) {
          handleReceiptSubmit(e.target.files[0]);
    }
  }}
      style={{ display: 'none' }} 
    />
  </label>
        </div>
      <div id="purchases-goals" style={{ marginTop: '16px'}}>
        <div className="purchases-block">
          
          <h2>My Purchases</h2>
          {nextCon && purchases > 0 ?
          (<div style={{ marginBottom: '10px', textAlign: 'right' }}>
            <button id="group-by-category" onClick={() => setGroupBy(prev => prev === 'category' ? 'date' : 'category')}>
              Switch Grouping (Current: {groupBy})
            </button>
          </div>) : (
            <div className="empty-state">
              <p>No purchases to display.</p>
            </div>
          )}
          {nextCon && purchases > 0 && (<div className="purchases-container" style={{  }}>
  <div className="purchases-header" style={{ /* ...  */}}>
    <h3>Purchases</h3>
  </div>
  
  
  <PurchaseList 
    groupedData={groupedPurchases} 
    groupBy={groupBy} 
    setGroupBy={setGroupBy} 
  />
</div>)}
        </div>
        <div id="goals">
        <h2>My Goals</h2>
        </div>
      </div> 
      <div id="history">
        <h2>My History</h2>
      </div> 
    </div>
    </>
  );
}

export default function App() {
  const checkUser = async () => {
  try {
    const session = await fetchAuthSession();
    if (!session.tokens) throw new Error("No session");
  } catch (err) {
    console.log("User not authenticated, redirecting to login...");
  }
}
  return (
    <BrowserRouter basename="/">
      <Routes>
        {/*{console.log("Defining Routes...")}*/}
        { <Route path="/" element={<LandingPage />} /> }
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
