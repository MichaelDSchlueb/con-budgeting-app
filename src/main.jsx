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
  redirect_uri: "https://main.dymkwrcw8goz2.amplifyapp.com/dashboard",
  response_type: "code",
  scope: "email openid phone",
};

// 2. Use the EXACT same name in the configure block
const amplifyconfig = {
  "Auth": {
    "Cognito": {
      "userPoolId": "us-east-2_940baSDal", 
      "userPoolClientId": "4e78f6nhrd3tekcbl18nupjric",
      "loginWith": {
        "oauth": {
          "domain": "your-domain.auth.us-east-2.amazoncognito.com",
          "scopes": ["openid", "email", "profile", "aws.cognito.signin.user.admin"],
          "redirectSignIn": ["https://main.dymkwrcw8goz2.amplifyapp.com/dashboard"],
          "redirectSignOut": ["https://main.dymkwrcw8goz2.amplifyapp.com/"],
          "responseType": "code"
        }
      }
    }
  }
};

Amplify.configure(amplifyconfig);


// Use it in your render

console.log("Starting app render...");

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider {...cognitoAuthConfig}>
      <App />
    </AuthProvider>
  </StrictMode>
)
