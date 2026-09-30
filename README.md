# FinGenie Backend

This is the backend repository for **FinGenie**, an AI-powered financial tracking and insights application.

## 🚀 Live Demo

You can check out the live version of the application deployed on Vercel here:
**[FinGenie Frontend 🚀](https://fingenie-frontend-new1.vercel.app/)**

> ⚠️ **Note for Testers:**  
> Google Authentication is currently facing some issues in the production environment. If you want to dive in and check out how the application works, please use the following standard login credentials:
> 
> **Email:** `test123@gmail.com`  
> **Password:** `Abc@123`

## 🛠️ Tech Stack

- **Node.js** & **Express.js** (Server)
- **MongoDB** (Database)
- **Redis & BullMQ** (Background Job Processing)
- **Google Gemini API** (AI-driven Insights and Statement Parsing)
- **Passport.js** (Authentication)

## 📦 Features

- User Authentication (Local and Google OAuth)
- Advanced Transaction Management (including PDF/CSV generation and parsing)
- AI-Powered Chat & Financial Insights
- Robust Background Job Processing
- Goal Tracking & Savings Projections

## ⚙️ Getting Started (Local Development)

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in your keys.
4. Start the server:
   ```bash
   npm run dev
   ```

## 🤝 Reach Out

Feel free to check out the [live application](https://fingenie-frontend-new1.vercel.app/) and reach out if you have any questions or feedback!
