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
import boto3 from 'aws-sdk/clients/s3';

function LandingPage() {
  const auth = useOIDCAuth();
  console.log("Auth state in LandingPage:", auth);

  const signOutRedirect = () => {
    const clientId = "5d32h4mt57n9ljti8d8fhkcflt";
    const logoutUri = "https://main.d12345.amplifyapp.com/";
    const cognitoDomain = "https://main.d12345.amplifyapp.com/";
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
  const [totalBudget, setTotalBudget] = useState(1250);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState('category'); // New state for grouping
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const user = auth?.user;
  const signOut = SignOut;
  const database_client = boto3.resource('dynamodb', { region: 'us-east-2' });
  const table = dynamodb.Table('User_Profiles')

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

  {/*const userID = (user) => {
    if (!user) return "Unknown_User";
    user_ref = table.query(KeyConditionExpression=Key('user_sub').eq(user.sub))
    if (user_ref.Items.length > 0) {
      console.log(user_ref.Items[0])
      return user_ref.Items[0].user_id;
    }
    else {
      // can we add a new user to the table here? start onboarding flow?
      return "Unknown_User";
    }
  }; */}

  const handleReceiptSubmit = async (file) => {
    console.log("File detected:", file); // If this is undefined, the input isn't working
    if (!file) return;
    const metadata = { 
      user_id: 'Michael_S', 
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
    fetch('https://p1hs04nmxa.execute-api.us-east-2.amazonaws.com/cg-prod/purchases?user_id=MichaelS')
      .then(res => res.json())
      .then(data => setPurchases(JSON.parse(data.body)));
  }
}, [user]); // Trigger when the user logs in */
  

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
    return purchases.reduce((total, item) => total + (parseFloat(item.price) || 0), 0);
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
  fetch('https://p1hs04nmxa.execute-api.us-east-2.amazonaws.com/cg-prod/purchases?user_id=MichaelS')
      .then(response => response.json())
      .then(data => {
        console.log("RAW API DATA", data)
        setPurchases(JSON.parse(data.body)); // Assuming the API returns a JSON string in the body
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
    
    const total = items.reduce((sum, item) => {
      // 2. Ensure amount is a number, even if it comes in as a string
      const amount = parseFloat(item.price) || 0;
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
              <span>{p.item}</span>
              <span>${p.amount}</span>
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
        <h2>Good afternoon, Min!</h2>
        <button onClick={signOut}>Sign out</button>
        <h3>My Spending</h3>
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
              <div id="DonutGuage" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <DonutGauge percent={percentUsed} />
                <p>Spending: ${currentSpend} / ${totalBudget}</p>
              </div>
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
              <p>Based on your spending, we recommend checking out the art vendors on the 3rd floor for some unique finds!</p>
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
      <div id="purchases-goals" style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-around' }}>
        <div className="purchases-block">
          
          <h2>My Purchases</h2>
          <div style={{ marginBottom: '10px', textAlign: 'right' }}>
            <button id="group-by-category" onClick={() => setGroupBy(prev => prev === 'category' ? 'date' : 'category')}>
              Switch Grouping (Current: {groupBy})
            </button>
          </div>
          <div className="purchases-container" style={{  }}>
  <div className="purchases-header" style={{ /* ...  */}}>
    <h3>Purchases</h3>
  </div>
  
  
  <PurchaseList 
    groupedData={groupedPurchases} 
    groupBy={groupBy} 
    setGroupBy={setGroupBy} 
  />
</div>
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
        {console.log("Defining Routes...")}
        { <Route path="/" element={<LandingPage />} /> }
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
