// src/routes.js
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

// Import models
const Event = mongoose.model('Event');
const Contract = mongoose.model('Contract');

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Get all events with pagination and filtering
router.get('/events', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Build filter
    const filter = {};
    
    if (req.query.contractId) {
      filter.contractId = req.query.contractId;
    }
    
    if (req.query.eventName) {
      filter.eventName = req.query.eventName;
    }
    
    if (req.query.filter) {
      // General text filter across multiple fields
      const textFilter = req.query.filter;
      filter.$or = [
        { contractId: { $regex: textFilter, $options: 'i' } },
        { eventName: { $regex: textFilter, $options: 'i' } },
        { txId: { $regex: textFilter, $options: 'i' } }
      ];
    }
    
    // Execute query
    const events = await Event.find(filter)
      .sort({ blockHeight: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count for pagination
    const total = await Event.countDocuments(filter);
    
    res.json({ events, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a specific event by txId
router.get('/events/:txId', async (req, res) => {
  try {
    const event = await Event.findOne({ txId: req.params.txId });
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get contract information
router.get('/contracts/:contractId', async (req, res) => {
  try {
    const [address, contractName] = req.params.contractId.split('.');
    
    const contract = await Contract.findOne({ address, contractName });
    
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    
    // Add contractId for consistency
    const response = contract.toObject();
    response.contractId = req.params.contractId;
    
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get overall stats
router.get('/stats', async (req, res) => {
  try {
    const totalEvents = await Event.countDocuments();
    const uniqueContracts = await Contract.countDocuments();
    
    // Get the last processed block across all contracts
    const latestContract = await Contract.findOne().sort({ lastProcessedBlock: -1 });
    const lastProcessedBlock = latestContract ? latestContract.lastProcessedBlock : 0;
    
    res.json({
      totalEvents,
      uniqueContracts,
      lastProcessedBlock
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get event counts for chart
router.get('/stats/event-counts', async (req, res) => {
  try {
    const range = req.query.range || 'week';
    let timeRange, groupFormat;
    
    // Configure time range and format based on requested range
    switch (range) {
      case 'day':
        timeRange = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        groupFormat = { hour: 'numeric' };
        break;
      case 'week':
        timeRange = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
        groupFormat = { month: 'short', day: 'numeric' };
        break;
      case 'month':
        timeRange = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
        groupFormat = { month: 'short', day: 'numeric' };
        break;
      default:
        timeRange = 7 * 24 * 60 * 60 * 1000;
        groupFormat = { month: 'short', day: 'numeric' };
    }
    
    const startDate = new Date(Date.now() - timeRange);
    
    // Get events within the time range
    const events = await Event.find({ timestamp: { $gte: startDate } });
    
    // Group events by time period
    const counts = {};
    const formatter = new Intl.DateTimeFormat('en-US', groupFormat);
    
    events.forEach(event => {
      const date = new Date(event.timestamp);
      const formattedDate = formatter.format(date);
      
      if (!counts[formattedDate]) {
        counts[formattedDate] = 0;
      }
      
      counts[formattedDate]++;
    });
    
    // Convert to the format expected by the chart
    const chartData = Object.keys(counts).map(label => ({
      label,
      count: counts[label]
    }));
    
    // Sort by date
    chartData.sort((a, b) => {
      return new Date(a.label) - new Date(b.label);
    });
    
    res.json(chartData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get contract stats for top contracts
router.get('/stats/contracts', async (req, res) => {
  try {
    const contracts = await Contract.find().sort({ lastProcessedBlock: -1 }).limit(10);
    
    // For each contract, get the event count
    const contractStats = await Promise.all(contracts.map(async (contract) => {
      const contractId = `${contract.address}.${contract.contractName}`;
      const eventCount = await Event.countDocuments({ contractId });
      
      return {
        contractId,
        address: contract.address,
        contractName: contract.contractName,
        lastProcessedBlock: contract.lastProcessedBlock,
        eventCount
      };
    }));
    
    res.json(contractStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;