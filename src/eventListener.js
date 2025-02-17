require('dotenv').config();
const axios = require('axios');
const { StacksMainnet } = require('@stacks/network');
const { cvToValue, deserializeCV } = require('@stacks/transactions');
const { saveEvent, updateContractBlock } = require('./database');

class EventListener {
    constructor() {
        this.network = new StacksMainnet();
        this.apiUrl = process.env.STACKS_API_URL || 'https://api.hiro.so';
        this.pollingInterval = 10000; // 10 seconds
        this.activeIntervals = {};
        this.offset = 0; // Track offset globally
    }

    async startPolling(contractAddress, contractName) {
        const contractId = `${contractAddress}.${contractName}`;
        let lastProcessedBlock = 0;

        console.log(`Starting polling for contract: ${contractId}`);

        const pollEvents = async () => {
            try {
                const events = await this.fetchContractEvents(contractId, lastProcessedBlock + 1);
                
                for (const event of events) {
                    const txDetails = await this.fetchTransactionDetails(event.tx_id);
                    // Ensure all required fields are present with fallback values
                    const decodedEvent = {
                        contractId: event.contract_id || `${contractAddress}.${contractName}`, // Use contractAddress.contractName if contract_id is missing
                        txId: event.tx_id,
                        eventName: event.event_type,
                        blockHeight: txDetails.block_height || 0,
                        blockHash: txDetails.block_hash || null, 
                        nonce: txDetails.nonce || null, 
                        fees: txDetails.fee_rate || null,
                        timestamp: event.block_time ? new Date(event.block_time * 1000) : new Date(), 
                        value: event.contract_log?.value || {} 
                    };

                    // Log event for debugging purposes
                    console.log(`Decoded event: ${JSON.stringify(decodedEvent)}`);

                    // Save event and update contract block
                    await saveEvent(decodedEvent);
                    await updateContractBlock(contractAddress, contractName, decodedEvent.block_height);
                    
                    if (decodedEvent.block_height > lastProcessedBlock) {
                        lastProcessedBlock = decodedEvent.block_height;
                    }
                }
            } catch (error) {
                console.error(`Error polling contract ${contractId}:`, error.message);
            }
        };

        // Initial poll and then every 10 seconds
        await pollEvents();
        this.activeIntervals[contractId] = setInterval(pollEvents, this.pollingInterval);
    }

    async fetchContractEvents(contractId, fromBlock, limit = 50) {
        try {
            const url = `${this.apiUrl}/extended/v1/contract/${contractId}/events`;
            const response = await axios.get(url, {
                params: { limit, offset: this.offset } // Use dynamic offset
            });

            this.offset += limit; // Increment offset after fetching
            return response.data.results || [];
        } catch (error) {
            if (error.response?.status === 404) {
                return [];
            }
            throw error;
        }
    }

    stopPolling(contractId) {
        if (this.activeIntervals[contractId]) {
            clearInterval(this.activeIntervals[contractId]);
            delete this.activeIntervals[contractId];
        }
    }

    async fetchTransactionDetails(txId) {
        try {
            const response = await require('axios').get(`https://api.hiro.so/extended/v1/tx/${txId}`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching transaction details for ${txId}:`, error.message);
            return {};
        }
    }
}

module.exports = new EventListener();
