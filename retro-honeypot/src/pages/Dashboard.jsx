import React, { useState, useEffect } from 'react';
import { webSocketService } from '../services/websocket';
import { fetchLogs } from '../services/api';

const Dashboard = () => {
    const [attacks, setAttacks] = useState([]);
    const [stats, setStats] = useState({
        total: 0,
        commands: 0,
        logins: 0,
        hashes: 0,
        pending: 0
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Load initial logs
        const loadInitialLogs = async () => {
            try {
                const initialLogs = await fetchLogs();
                setAttacks(initialLogs);
                updateStats(initialLogs);
            } catch (err) {
                console.error('Failed to load initial logs:', err);
            } finally {
                setIsLoading(false);
            }
        };

        loadInitialLogs();

        // Setup WebSocket listeners
        const handleNewLog = (event) => {
            setAttacks(prev => [{
                ...event.data,
                id: `${event.data.timestamp}-${Math.random().toString(36).substr(2, 9)}`,
                blockchainStatus: 'pending',
                txHash: null,
                blockNumber: null
            }, ...prev.slice(0, 199)]); // Keep max 200 logs
            
            setStats(prev => ({
                ...prev,
                total: prev.total + 1,
                pending: prev.pending + 1,
                [event.data.type === 'command' ? 'commands' : 
                 event.data.type === 'login_attempt' ? 'logins' : 
                 event.data.type === 'hash_capture' ? 'hashes' : 'total']: prev[event.data.type === 'command' ? 'commands' : 
                                                                           event.data.type === 'login_attempt' ? 'logins' : 
                                                                           event.data.type === 'hash_capture' ? 'hashes' : 'total'] + 1
            }));
        };

        const handleBlockchainConfirmation = (event) => {
            setAttacks(prev => prev.map(attack => 
                attack.timestamp === event.data.timestamp && 
                attack.content === event.data.content
                    ? { ...attack, ...event.data, blockchainStatus: 'confirmed' }
                    : attack
            ));
            
            setStats(prev => ({
                ...prev,
                pending: Math.max(0, prev.pending - 1)
            }));
        };

        const newLogRemover = webSocketService.addListener('new_log', handleNewLog);
        const confirmRemover = webSocketService.addListener('blockchain_confirmation', handleBlockchainConfirmation);

        return () => {
            newLogRemover();
            confirmRemover();
        };
    }, []);

    const updateStats = (logs) => {
        const newStats = {
            total: logs.length,
            commands: logs.filter(log => log.type === 'command').length,
            logins: logs.filter(log => log.type === 'login_attempt').length,
            hashes: logs.filter(log => log.type === 'hash_capture').length,
            pending: logs.filter(log => log.blockchainStatus !== 'confirmed').length
        };
        setStats(newStats);
    };

    const getThreatColor = (threatLevel) => {
        switch (threatLevel) {
            case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
            case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
            case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
        }
    };

    const getTypeColor = (type) => {
        switch (type) {
            case 'command': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
            case 'login_attempt': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
            case 'hash_capture': return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200';
            case 'download': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white mb-6">
                Live Attack Dashboard
            </h1>
            
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                <StatCard 
                    title="Total Attacks" 
                    value={stats.total} 
                    color="bg-blue-600" 
                    icon="👾" 
                />
                <StatCard 
                    title="Commands" 
                    value={stats.commands} 
                    color="bg-green-600" 
                    icon="💻" 
                />
                <StatCard 
                    title="Login Attempts" 
                    value={stats.logins} 
                    color="bg-purple-600" 
                    icon="🔑" 
                />
                <StatCard 
                    title="Hashes Captured" 
                    value={stats.hashes} 
                    color="bg-pink-600" 
                    icon="🕵️" 
                />
                <StatCard 
                    title="Pending TXs" 
                    value={stats.pending} 
                    color={stats.pending > 0 ? "bg-yellow-600" : "bg-gray-600"} 
                    icon="⏳" 
                />
            </div>

            {/* Live Attacks Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">IP</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Content</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Time</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Threat</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">TX Hash</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {attacks.map((attack) => (
                                <tr key={attack.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getTypeColor(attack.type)}`}>
                                            {attack.type.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 dark:text-gray-300">
                                        {attack.ip}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300 max-w-xs truncate">
                                        <code className="font-mono">{attack.content}</code>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                        {new Date(attack.timestamp).toLocaleTimeString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getThreatColor(attack.threatLevel)}`}>
                                            {attack.threatLevel}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                        {attack.blockchainStatus === 'confirmed' ? (
                                            <a
                                                href={`https://sepolia.etherscan.io/tx/${attack.txHash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-500 hover:underline font-mono"
                                                title={attack.txHash}
                                            >
                                                {`${attack.txHash.substring(0, 6)}...${attack.txHash.substring(attack.txHash.length - 4)}`}
                                            </a>
                                        ) : (
                                            <span className="text-yellow-500 flex items-center">
                                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-yellow-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Pending
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ title, value, color, icon }) => (
    <div className={`${color} rounded-lg p-4 text-white shadow`}>
        <div className="flex justify-between items-center">
            <div>
                <h3 className="text-sm font-medium">{title}</h3>
                <p className="text-2xl font-bold">{value}</p>
            </div>
            <span className="text-2xl">{icon}</span>
        </div>
    </div>
);

export default Dashboard;