# <img src="https://github.com/lectrn/branding/raw/main/icon/png/icon_bg.png" width="22"> Lectrn [![Twitter Follow](https://img.shields.io/twitter/follow/lectrn?style=social)](https://twitter.com/lectrn) ![GitHub Repo stars](https://img.shields.io/github/stars/lectrn/lectrn?style=social) 
A social network for humans.

This is the reference server implementation for the Lectrn social network.

**Status: very little is implemented.**

### Table of Contents
* [Setup](#setup)
  * [Prerequisites](#prerequisites)
  * [Development Setup](#development-setup)
  * [Production Setup](#production-setup)
* [Configuration](#configuration)
  * [Development Example](#development-example)
  * [Production Example](#production-example)

## Setup

### Prerequisites

 * Node.js
 * PostgreSQL

### Development Setup

```bash
# Ensure that your NODE_ENV is not "production"
git clone https://github.com/lectrn/lectrn
cd lectrn
npm install
npm run migrate
npm run seed # Optional, only if you want example content
# Configure your .env file, see section Configuration
npm start
```

### Production Setup

We currently do not support production deployments of Lectrn, as it is not ready. However, in the future, PostgreSQL will be required as the database, and Lectrn will probably be dockerized.

## Configuration

Configuration happens in the `.env` file, located in the root directory of Lectrn. (If it does not exist, create it.)

Options:

| Name | Description | Required? |
|-|-|-|
| `NODE_ENV` | This must be set to `production` when running in production. | in production |
| `SESSION_SECRET` | Secret used for sessions. | yes |
| `BASE_URL` | The public URL of your Lectrn instance. | yes |
| `PG_CONNECTION_STRING` | The connection string of your PostgreSQL database. | yes |
| `PORT` | HTTP port of server. | no (default: `8080`)

### Development Example

```env
SESSION_SECRET=whatever
BASE_URL=http://localhost:13673
PORT=13673
```

### Production Example

```env
SESSION_SECRET=PUT A LONG, RANDOM STRING HERE
NODE_ENV=production
BASE_URL=https://lectrn.example.com
PORT=13673
```

(Make sure to replace `PUT A LONG, RANDOM STRING HERE` with an actual long, random string, or else your instance will be easily compromised.)

*You should reverse-proxy to `localhost:13673` and use HTTPS through NGINX or Apache.*
