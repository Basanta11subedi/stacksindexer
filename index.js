// src/index.js
const express = require('express');
const cors = require('cors');
const { connectToDatabase } = require('./database');
const eventListener = require('./eventListener');
const routes = require('./routes');

async function start() {
    await connectToDatabase();
    
    // Create Express app
    const app = express();
    
    // Enable CORS
    app.use(cors());
    
    // Parse JSON
    app.use(express.json());
    app.get("/",(req,res)=>{
        console.log("this is home calling");
        res.send("<h1>this is stack backend</h1>");
    })
    
    // Use our API routes
    app.use('/api', routes);
    
    // Start the server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
    
    // Start event polling
    await eventListener.startPolling('SPNWZ5V2TPWGQGVDR6T7B6RQ4XMGZ4PXTEE0VQ0S', 'mojo');
}

start();