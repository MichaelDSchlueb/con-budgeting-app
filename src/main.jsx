import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { AuthProvider } from "react-oidc-context";

// main.jsx
Amplify.configure({
    Auth: {
        Cognito: {
            userPoolId: 'us-east-2_5KrMfc4NY', // Extracted from your authority URL
            userPoolClientId: '5d32h4mt57n9ljti8d8fhkcflt',
            identityPoolId: 'us-east-2:48d768bb-fd93-4a3c-b24f-1c3af24ee454', // The ID from the pool you just created
            loginWith: {
                email: true
            }
        }
    },
    Storage: {
        S3: {
            bucket: 'your-congreen-bucket-name',
            region: 'us-east-2'
        }
    }
});

// Example login call
try {
    const user = await Auth.signIn(username, password);
    // ... logic
} catch (error) {
    console.log("FULL ERROR OBJECT:", error);
    console.log("ERROR CODE:", error.code);
    console.log("ERROR MESSAGE:", error.message);
}


// Use it in your render

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider {...cognitoAuthConfig}>
      <App />
    </AuthProvider>
  </StrictMode>
)
