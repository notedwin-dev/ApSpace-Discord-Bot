# ApSpace Discord Bot

![ApSpace logo](./public/apspace-black.svg)

Stay up to date with your APU auto-scheduled timetable right in your Discord server! This bot helps you track your class schedule, find empty rooms, and automatically shares updates with your family or friends.

## 📚 Table of Contents
- [Features](#%EF%B8%8F-features)
- [Why This Bot?](#-why-create-this-bot)
- [Tech Stack](#-tech-stack)
- [Setup Instructions](#-setup-instructions)
- [Usage Guide](#-usage-guide)
- [Support](#-support)

## ⚙️ Features

- **🔄 Personal Timetable Management**
  - Remember your intake code and tutorial group for quick access
  - View timetable by date, weekday, or module code
  - Automatic weekly and daily timetable updates
  - Smart filtering based on tutorial groups
  - Personalized DM notifications for your schedule
  - Clear distinction between online and physical classes

- **📬 Smart Notifications**
  - Choose between server-wide announcements and personal DMs
  - Rate-limited notifications to prevent Discord API throttling
  - Daily updates at 6:00 AM (Monday-Friday)
  - Weekly schedule overview on Sunday at 8:00 PM
  - Intelligent buffering between messages for reliability

- **🤖 Bot Features**
  - Slash command support for easy interaction
  - Smart error handling and user feedback
  - Efficient rate limiting for reliable operation
  - Embedded message formatting for better readability

## 🤔 Why Create This Bot?

The main reason why I wanted to automate this is because my parent will always chase me for weekly timetable updates... 

I will always hear questions like ***"Is the timetable still the same as last week?"***, ***"What time is your class starting for tomorrow?"***, although clearly I have already written the schedule in a WhatsApp group, I will still be chased for latest updates... 

They complained that **screenshots are too difficult to read**, so the only way to keep them updated is by **manually typing out the timetables weekly**. I have been doing this **manually** for the **past 2 years of my Diploma studies**. 

But I thought, why do it manually if I can make an automation to do it for me? I'm a Software Engineering student myself, I built bots for my clients as freelance... 

So why not build something that could ***make my life easier once and for all?*** And this is where **ApSpace Discord Bot** comes into place. Your family members surely do not have access to an ApSpace account, but what they do have is your contact such as WhatsApp and Discord. 

## 🧑‍💻 Tech Stack

- **Runtime**
  - Node.js ≥ v20.x

- **Core Libraries**
  - Discord.js - Discord bot framework
  - Prisma ORM - Database management
  - PostgreSQL - Database system
  - Axios - API communication

- **Development Tools**
  - dotenv - Environment configuration
  - ESLint - Code quality
  - Jest - Testing

## 🚀 Setup Instructions

1. **Prerequisites**
   ```bash
   Node.js ≥ v20.x
   PostgreSQL Client
   ```

2. **Installation**
   ```bash
   # Clone the repository
   git clone https://github.com/yourusername/ApSpace-Discord-Bot.git
   cd ApSpace-Discord-Bot

   # Install dependencies
   npm install

   # Set up environment variables
   cp .env.example .env
   # Edit .env with your Discord token and database details
   ```

3. **Database Setup**
   ```bash
   # Run database migrations
   npx prisma migrate dev
   ```

4. **Starting the Bot**
   ```bash
   # Deploy slash commands
   npm run deploy-commands

   # Start the bot
   npm start
   ```

## 📖 Usage Guide

### Basic Commands

- `/setintake <intake_code> <tutorial_group> [dm_notifications]` - Set your intake code, tutorial group, and DM preferences
- `/timetable` - View timetable information
  - `/timetable today [intake_code] [tutorial_group] [sort_by]` - Get today's timetable
  - `/timetable weekly [intake_code] [tutorial_group] [sort_by]` - Get weekly timetable
  - `/timetable daily <weekday> [intake_code] [tutorial_group] [sort_by]` - Get timetable for a specific weekday
  - `/timetable date <date> [intake_code] [tutorial_group] [sort_by]` - Get timetable for a specific date
  - `/timetable empty-rooms [start_time] [end_time] [date]` - Find empty rooms
  - `/timetable room <room_number> [date]` - Get schedule for a specific room
- `/schedule` - Configure server-wide timetable settings
  - `/schedule channel <channel>` - Set channel for server announcements
  - `/schedule intake <intake_code>` - Set server-wide default intake
  - `/schedule disable` - Disable server-wide announcements

### Schedule Updates

The bot automatically sends:
- Daily schedule updates (6:00 AM, Monday-Friday)
- Weekly schedule overview (8:00 PM, Sunday)
- Immediate updates for schedule changes

#### Notification Features
- Server-wide announcements in designated channels
- Personal DM notifications (opt-in)
- Rate-limited message delivery to prevent Discord throttling
- Clear distinction between online and physical classes
- Tutorial group specific filtering

## 💝 Support

If you find this bot helpful, consider supporting the project:

[![ko-fi](https://img.shields.io/badge/-Support_Me_On_Ko--fi-black?style=flat-square&logo=kofi&logoColor=white)](https://ko-fi.com/J3J7PPGKH)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
