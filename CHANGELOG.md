# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.0] - 2025-08-09

### Added
- **Module Management System**: New `/timetable manage-modules` command for blacklisting unwanted modules
  - Interactive multi-select menu showing all available modules for your intake
  - Real-time preview of hidden modules with confirmation system
  - Persistent storage of user preferences in database
  - Session timeout protection (5 minutes)
- **Automatic Module Filtering**: All timetable commands now respect excluded module preferences
  - Applied to `/timetable today`, `/timetable daily`, `/timetable weekly`, and `/timetable date`
  - Helps students hide elective modules they didn't select
- **Enhanced Room Name Display**: Improved room name formatting across all commands
  - Standard room codes (e.g., `B-06-05`) now display in uppercase
  - Auditorium names maintain proper capitalization (e.g., `Auditorium 4`)
  - Tech lab names display as "Tech Lab" with proper formatting
  - Added `displayRoomName()` helper function for consistent formatting

### Changed
- **Database Schema**: Added `excludedModules` field to User model for storing module preferences
- **Helper Functions**: Enhanced room name handling with separate functions for search vs display
- **Code Organization**: Moved `capitalizeRoomName` function to helpers for better reusability

### Technical
- Applied database migration `20250809144243_add_excluded_modules_to_user`
- Updated all timetable commands to import and use new helper functions
- Enhanced error handling in module management command

## [0.4.0] - 2025-07-29

### Added
- **Simplified Weekly Command**: Streamlined weekly timetable options for better user experience
- **Interactive Timetable Selection**: Enhanced timetable selection with better UI

### Changed
- **Timetable Cache**: Added cache expiration check on bot startup for better performance
- **Weekly Command Options**: Simplified user interface for weekly timetable command

### Technical
- Improved timetable caching system
- Enhanced interactive selection mechanisms

## [0.3.1] - 2025-07-27

### Added
- **Autocomplete Support**: Added autocomplete for the week option using the `fetchAllTimetable` function

### Fixed
- **Group Filtering**: Ensured group filtering is applied after fetching timetables by intake code
- **Tutorial Group Handling**: Improved filtering logic to handle tutorial groups more effectively
- **Debug Logging**: Removed debug log for class grouping in weekly command

### Documentation
- Updated README to reflect new autocomplete feature and group filtering fixes

## [0.3.0] - 2025-06-17

### Fixed
- **Server Operations**: Removed unused guild name property from server upsert operations
- **Timetable Display**: Updated timetable view description to include intake code
- **Server ID Reference**: Corrected server ID reference in upsert operations for schedule command

### Enhanced
- Better error handling in server-related operations
- Improved timetable information display

## [0.2.3] - 2025-06-11

### Fixed
- **Database Cleanup**: Fixed timetable cleanup by deleting associated class schedules before removing timetable entries

### Technical
- Improved database relationship handling
- Better cascade deletion for timetable data

## [0.2.2] - 2025-06-10

### Added
- **Command Screenshots**: Added screenshots for timetable commands in README
- **Help Command**: Added comprehensive help command with detailed usage instructions
- **Environment Configuration**: Added example environment configuration file
- **FAQ Section**: Added FAQ section to README for room search guidance

### Enhanced
- **Room Schedule**: Improved room schedule retrieval and display with enhanced grouping and pagination
- **Room Normalization**: Added room normalization utility for consistent room handling
- **Weekly Timetable**: Enhanced weekly timetable command with display format options
- **Command Descriptions**: Enhanced command descriptions in README for better clarity

### Fixed
- **Room Schedule Display**: Enhanced room schedule display with grouping and pagination for better readability
- **Schedule Permissions**: Updated schedule command permissions to include ModerateMembers

### Technical
- **Code Organization**: Refactored timetable command structure for better organization
- **Subcommand Structure**: Moved timetable subcommands to separate modules
- **Helper Functions**: Moved utility functions to helpers module for better organization

## [0.2.1] - 2025-06-10

### Added
- **DM Notifications**: Added dmNotifications column to User model for user preference control
- **Server-wide Features**: Added default intake code column to Server model
- **Automatic Updates**: Enhanced timetable updates with server-wide announcements and personal DMs

### Enhanced
- **Schedule Command**: Enhanced with subcommands for channel, intake code, and disable updates
- **Timetable Updates**: Enhanced with filtering for tutorial groups and online classes
- **SetIntake Command**: Enhanced to support DM notifications and improved error handling
- **Weekly Pagination**: Enhanced weekly timetable command with pagination and grouping

### Technical
- **Database Schema**: Updated User and Server models with new notification features
- **Cache Management**: Improved fetchAndCacheTimetable documentation and positioning

## [0.2.0] - 2025-06-09

### Added
- **Automated Notifications**: Added cron jobs for daily and weekly timetable updates
- **Schedule Command**: Added schedule command for setting up automatic timetable updates
- **Timetable System**: Implemented comprehensive timetable command with subcommands
- **SetIntake Command**: Added setintake command for user intake code and tutorial group management
- **API Integration**: Added timetable API module for fetching and caching data
- **Visual Assets**: Added ApSpace logo, favicon, and icon images

### Enhanced
- **Database System**: Implemented database interactions and event handling
- **Command Structure**: Added daily, weekly, and specific date schedule fetching
- **User Interface**: Enhanced filtering for physical locations and improved subcommand options

### Documentation
- Updated README.md with enhanced features, setup instructions, and usage guide
- Added comprehensive feature documentation and usage examples

## [0.1.0] - 2025-06-09

### Added
- **Project Foundation**: Initialize project with package.json and package-lock.json
- **Database Schema**: Added database migrations for User, ServerUser, Server, Timetable, and ClassSchedule models
- **Core Infrastructure**: Set up PostgreSQL database structure
- **Initial Documentation**: Basic README.md setup

### Technical
- Set up Node.js project structure
- Configured Prisma ORM for database management
- Established basic project documentation

---

## Format Guide

### Types of Changes
- `Added` for new features
- `Changed` for changes in existing functionality  
- `Deprecated` for soon-to-be removed features
- `Removed` for now removed features
- `Fixed` for any bug fixes
- `Security` for vulnerability fixes
- `Technical` for internal/development changes
- `Documentation` for documentation updates
- `Enhanced` for improvements to existing features

### Version Numbers
This project follows [Semantic Versioning](https://semver.org/):
- **MAJOR** version (1.0.0) for incompatible API changes
- **MINOR** version (0.x.0) for backwards-compatible functionality additions
- **PATCH** version (0.0.x) for backwards-compatible bug fixes

During initial development (0.x.x), breaking changes may occur in minor versions.
