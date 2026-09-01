# ConGreen: You're all Good To Geek!

![Main Architecture Diagram for ConGreen](architecture-diagrams/ConGreen%20DBMS%20Chart%20(Macro%20View).jpg)

## 1. Problem Statement

Fan conventions celebrating fandoms and community have become popular throughout the world. In North America alone, the Market Size for fan conventiuons hit $16B in 2026 alone and is projected to rise within the $1 billion range annually (Patel). Fan conventions in North America are providing a viable opportunity for economic growth; however, one of the biggest primary factors to this can often be seen through the context of the US Infation Crisis.

Mara Collins writes that in recent years, fan conventions have become more commercialized and for-profit, thus leading to "increased prices nearly across the board" because "venue costs alone may consume 30-40% of a convention's total operating budget." For instance, hotels will often increase their rates due to proximity around the time of the convention (Collins). The inflation era is only helping the convention operators afford their bills while leaving attendees at risk of becoming broke.

With that in mind, I combined my profession in Software and Data Engineering with my passion for fan conventions to develop this serverless to help convention users manage the budgets explicitly through visualizations, alerts, and forecasting. 

## 2. System Requirements

### Requirements Gathering

To gather requirements, I engineered an automated data pipeline to move the data from Google Sheets directly into Amazon Simple Storage Service for analysis using Amazon Athena.

![Google Form submission triggers a Google Script to send the new data directly to S3 via a Lambda API call. After S3 upload, Athena is used for requirements gathering based on SQL queries.](architecture-diagrams/Ingestion%20Drawing.jpg)

I engineered a Google Script that calls an AWS Lambda function to directly send the data into an Amazon S3 bucket for analytics. Post-receiving, I leveraged Amazon Athena to directly query against the user input to find requirements.

### Functional Requirements

- Intentional Profiling: The system must collect data (Local? Hotel? Food plan? Cosplay plans?) to adjust the user’s specific baseline.
- Regional Benchmarking: The system must calculate a user’s specific budget against the City Baseline
- Automated Ledger: The system must read digital receipts (via SES) and deduct them from the total budget.
- Physical Ingestion: The system must be able to scan/process physical receipts and deduct them from the total budget.
- Record Reversal: The System must provide a way for users to undo or change purchase records if necessary


### Non-Functional Requirements

- Visual Analytics: A dashboard for “Spend per Day” and “Total Weekend” views 
- Mobile-First Design: The system must have an optimized layout for high-mobility convention environments
- Scalability: The system must handle concurrent receipt processing during peak con hours 
- Security/Privacy: The system must encrypt user financial data at rest using AWS KMS (Key Management Service).
- Database for purchases: The system must provide a NoSQL database to track user purchases
- Databases for user info: The system must provide a NoSQL database to hold user information
- Latency: The system must retrieve user spending totals in under 100ms for the mobile dashboard. 


## 3. Architectural Design & AWS Component Mapping

## 4. Logo Design and Branding

## 5. MomoCon 2026 MVP

## 6. Looking Forward

## References

Patel, Debattata. “Fan Conventions Market Research Report 2033.” Dataintelo.Com, 30 Sept. 2025, https://dataintelo.com/report/fan-conventions-market. Accessed 27 Aug. 2026.

Collins, Mara. “True Cost of Attending a Cosplay Convention.” Mjtrends.Com, 12 June 2026, mjtrends.com/blog/2026/06/true-cost-of-attending-a-cosplay-convention/. 