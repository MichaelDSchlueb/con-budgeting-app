import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { AuthProvider } from "react-oidc-context";

// main.jsx
const cognitoAuthConfig = {
  authority: "https://cognito-idp.us-east-2.amazonaws.com/us-east-2_5KrMfc4NY",
  client_id: "5d32h4mt57n9ljti8d8fhkcflt",
  redirect_uri: "https://d84l1y8p4kdic.cloudfront.net/dashboard",
  response_type: "code",
  scope: "email openid phone",
};

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
