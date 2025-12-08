# 🌍 AI Travel Planner

An intelligent travel itinerary generator powered by **Google Gemini AI**. Simply enter your destination and travel dates, and let AI create a detailed, personalized day-by-day travel plan!

## ✨ Features

- 🤖 **AI-Powered Itineraries** - Uses Google Gemini 2.0 Flash for intelligent trip planning
- 📅 **Day-by-Day Breakdown** - Detailed activities with times and locations
- 💰 **Budget Estimates** - Automatic cost estimation for your trip
- 🎨 **Beautiful UI** - Modern, responsive design with gradients and animations
- ⚡ **No Database Required** - Stateless architecture for simplicity
- 🚀 **Easy Deployment** - Deploy to Vercel with one click

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- Google Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/KavinT06/itinerary-app.git
cd itinerary-app
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**

Create a `.env.local` file in the root directory:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

4. **Run the development server**
```bash
npm run dev
```

5. **Open your browser**

Visit [http://localhost:3000](http://localhost:3000)

## 🎯 How to Use

1. Fill in your personal information (name, email, phone)
2. Select your travel dates (departure and return)
3. Enter your destination (area, city, state/country)
4. Click "Generate Dream Itinerary"
5. Watch AI create your personalized travel plan!

## 📁 Project Structure

```
n_itenary-app/
├── app/
│   ├── api/
│   │   └── trips/
│   │       └── route.js        # AI trip generation API
│   ├── globals.css             # Global styles
│   ├── layout.js               # Root layout
│   └── page.jsx                # Main page component
├── public/                     # Static assets
├── .env.local                  # Environment variables
├── package.json                # Dependencies
└── README.md                   # This file
```

## 🛠️ Technology Stack

- **Frontend:** Next.js 15, React 19
- **Styling:** Tailwind CSS 4
- **AI:** Google Generative AI (Gemini 2.0 Flash)
- **Deployment:** Vercel

## 🌐 Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/KavinT06/itinerary-app)

### Manual Deployment

1. Push your code to GitHub
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Import your repository
4. Add environment variable:
   - **Name:** `GEMINI_API_KEY`
   - **Value:** Your Gemini API key
5. Deploy!

## 📝 API Reference

### POST `/api/trips`

Generate a travel itinerary.

**Request Body:**
```json
{
  "destination": "Manhattan, New York, USA",
  "startDate": "2025-12-15",
  "endDate": "2025-12-20",
  "createdBy": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "trip": {
    "id": "1733654321000",
    "title": "Trip to Manhattan, New York, USA",
    "destination": "Manhattan, New York, USA",
    "startDate": "2025-12-15",
    "endDate": "2025-12-20",
    "createdBy": "John Doe",
    "days": [
      {
        "day": 1,
        "date": "2025-12-15",
        "location": "Manhattan",
        "activities": [...]
      }
    ],
    "budget": {
      "currency": "USD",
      "estimated": 2500
    },
    "notes": "General travel tips..."
  }
}
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Your Google Gemini API key | Yes |

## 🎨 Customization

### Change AI Model

Edit `app/api/trips/route.js`:
```javascript
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
```

### Modify UI Colors

Edit `app/globals.css` or Tailwind classes in `app/page.jsx`

### Adjust Prompt

Edit the prompt in `app/api/trips/route.js` to customize trip generation

## 🐛 Troubleshooting

### "API key missing" error
- Ensure `.env.local` file exists with `GEMINI_API_KEY`
- Restart the dev server after adding the key

### Empty or invalid response
- Check your API key is valid
- Verify you haven't exceeded Gemini API quota
- Check console logs for detailed error messages

### Build errors
```bash
rm -rf node_modules package-lock.json
npm install
npm run dev
```

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Contact

- GitHub: [@KavinT06](https://github.com/KavinT06)
- Repository: [itinerary-app](https://github.com/KavinT06/itinerary-app)

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org)
- Powered by [Google Gemini AI](https://ai.google.dev)
- Styled with [Tailwind CSS](https://tailwindcss.com)

---

**Made with ❤️ by Kavin**
