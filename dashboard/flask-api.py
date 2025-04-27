from flask import Flask, request, jsonify, abort
from flask_cors import CORS
import pymongo
import json
import os
import logging
from datetime import datetime, timedelta
from functools import wraps
import threading
import time

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable Cross-Origin Resource Sharing

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("blockpot_api.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("BlockPot-API")

# Configuration
class Config:
    API_KEY = os.environ.get("BLOCKPOT_API_KEY", "test_api_key")
    MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017/")
    DB_NAME = os.environ.get("DB_NAME", "blockpot")
    COLLECTION_NAME = os.environ.get("COLLECTION_NAME", "command_logs")
    MAX_QUERY_DAYS = 30  # Maximum number of days to query logs

app.config.from_object(Config)

# Connect to MongoDB
try:
    mongo_client = pymongo.MongoClient(Config.MONGODB_URI)
    db = mongo_client[Config.DB_NAME]
    command_logs = db[Config.COLLECTION_NAME]
    logger.info("Connected to MongoDB successfully")
    
    # Create indexes
    command_logs.create_index("timestamp")
    command_logs.create_index("classification.threat_level")
    command_logs.create_index("src_ip")
    command_logs.create_index("blockchain_hash")
except Exception as e:
    logger.error(f"Failed to connect to MongoDB: {e}")
    mongo_client = None
    db = None
    command_logs = None

# API key authentication decorator
def require_api_key(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get("X-API-Key")
        if api_key and api_key == Config.API_KEY:
            return f(*args, **kwargs)
        else:
            logger.warning("Unauthorized API access attempt")
            abort(401)
    return decorated_function

# Routes
@app.route("/api/health", methods=["GET"])
def health_check():
    """API health check endpoint"""
    if mongo_client and db and command_logs:
        return jsonify({
            "status": "healthy",
            "db_connected": True,
            "version": "1.0.0",
            "timestamp": datetime.now().isoformat()
        }), 200
    else:
        return jsonify({
            "status": "unhealthy",
            "db_connected": False,
            "error": "Database connection failed",
            "timestamp": datetime.now().isoformat()
        }), 500

@app.route("/api/command-logs", methods=["GET"])
@require_api_key
def get_command_logs():
    """Get command logs with filtering options"""
    try:
        # Parse query parameters
        limit = min(int(request.args.get("limit", 100)), 1000)  # Max 1000 results
        skip = int(request.args.get("skip", 0))
        threat_level = request.args.get("threat_level")
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")
        src_ip = request.args.get("src_ip")
        command_contains = request.args.get("command_contains")
        
        # Build query
        query = {}
        
        # Apply filters
        if threat_level:
            query["classification.threat_level"] = threat_level
            
        if src_ip:
            query["src_ip"] = src_ip
            
        if command_contains:
            query["command"] = {"$regex": command_contains, "$options": "i"}
            
        # Parse dates and add to query
        if start_date:
            try:
                start = datetime.fromisoformat(start_date)
                query["timestamp"] = query.get("timestamp", {})
                query["timestamp"]["$gte"] = start.isoformat()
            except ValueError:
                pass
                
        if end_date:
            try:
                end = datetime.fromisoformat(end_date)
                query["timestamp"] = query.get("timestamp", {})
                query["timestamp"]["$lte"] = end.isoformat()
            except ValueError:
                pass
        
        # If no date range specified, limit to the past week
        if "timestamp" not in query:
            one_week_ago = (datetime.now() - timedelta(days=7)).isoformat()
            query["timestamp"] = {"$gte": one_week_ago}
        
        # Get total count for pagination
        total_count = command_logs.count_documents(query)
        
        # Execute query
        results = list(command_logs.find(
            query,
            {"_id": 0}  # Exclude MongoDB _id field
        ).sort("timestamp", -1).skip(skip).limit(limit))
        
        return jsonify({
            "total": total_count,
            "limit": limit,
            "skip": skip,
            "results": results
        }), 200
        
    except Exception as e:
        logger.error(f"Error retrieving command logs: {e}")
        return jsonify({
            "error": "Failed to retrieve command logs",
            "details": str(e)
        }), 500

@app.route("/api/command-logs/batch", methods=["POST"])
@require_api_key
def add_command_logs_batch():
    """Add multiple command logs to the database"""
    try:
        # Check if request has valid JSON
        if not request.is_json:
            return jsonify({"error": "Request must be JSON"}), 400
            
        data = request.get_json()
        
        # Validate request structure
        if "evaluations" not in data or not isinstance(data["evaluations"], list):
            return jsonify({"error": "Invalid request format, 'evaluations' array required"}), 400
            
        evaluations = data["evaluations"]
        
        # Check if there are any evaluations to process
        if not evaluations:
            return jsonify({"message": "No evaluations to process"}), 200
            
        # Process and store each evaluation
        for eval_result in evaluations:
            # Add received_at timestamp
            eval_result["received_at"] = datetime.now().isoformat()
            
            # Insert into MongoDB
            command_logs.insert_one(eval_result)
            
        return jsonify({
            "status": "success", 
            "message": f"Successfully added {len(evaluations)} command logs"
        }), 200
        
    except Exception as e:
        logger.error(f"Error adding command logs batch: {e}")
        return jsonify({
            "error": "Failed to add command logs",
            "details": str(e)
        }), 500

@app.route("/api/command-logs/<blockchain_hash>", methods=["GET"])
@require_api_key
def get_command_log_by_hash(blockchain_hash):
    """Get a specific command log by its blockchain hash"""
    try:
        result = command_logs.find_one({"blockchain_hash": blockchain_hash}, {"_id": 0})
        
        if result:
            return jsonify(result), 200
        else:
            return jsonify({"error": "Command log not found"}), 404
            
    except Exception as e:
        logger.error(f"Error retrieving command log by hash: {e}")
        return jsonify({
            "error": "Failed to retrieve command log",
            "details": str(e)
        }), 500

@app.route("/api/stats/overview", methods=["GET"])
@require_api_key
def get_stats_overview():
    """Get overview statistics for the dashboard"""
    try:
        # Get timeframe from query parameter, default to 'day'
        timeframe = request.args.get("timeframe", "day")
        
        # Determine date range based on timeframe
        now = datetime.now()
        if timeframe == "hour":
            start_date = (now - timedelta(hours=1)).isoformat()
        elif timeframe == "day":
            start_date = (now - timedelta(days=1)).isoformat()
        elif timeframe == "week":
            start_date = (now - timedelta(weeks=1)).isoformat()
        elif timeframe == "month":
            start_date = (now - timedelta(days=30)).isoformat()
        else:
            start_date = (now - timedelta(days=1)).isoformat()
            
        # Query for base stats
        base_query = {"timestamp": {"$gte": start_date}}
        
        # Get total count
        total_count = command_logs.count_documents(base_query)
        
        # Get counts by threat level
        threat_level_counts = {
            "safe": command_logs.count_documents({**base_query, "classification.threat_level": "safe"}),
            "suspicious": command_logs.count_documents({**base_query, "classification.threat_level": "suspicious"}),
            "malicious": command_logs.count_documents({**base_query, "classification.threat_level": "malicious"})
        }
        
        # Get top 10 commands
        pipeline = [
            {"$match": base_query},
            {"$group": {"_id": "$command", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        top_commands = list(command_logs.aggregate(pipeline))
        
        # Get top 5 source IPs
        pipeline = [
            {"$match": base_query},
            {"$group": {"_id": "$src_ip", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 5}
        ]
        top_ips = list(command_logs.aggregate(pipeline))
        
        # Get latest activities
        latest_activities = list(command_logs.find(
            base_query,
            {"_id": 0, "command": 1, "timestamp": 1, "src_ip": 1, "classification.threat_level": 1}
        ).sort("timestamp", -1).limit(5))
        
        # Prepare the response
        response = {
            "total_commands": total_count,
            "threat_levels": threat_level_counts,
            "top_commands": [{
                "command": cmd["_id"],
                "count": cmd["count"]
            } for cmd in top_commands],
            "top_source_ips": [{
                "ip": ip["_id"],
                "count": ip["count"]
            } for ip in top_ips],
            "latest_activities": latest_activities,
            "timeframe": timeframe
        }
        
        return jsonify(response), 200
        
    except Exception as e:
        logger.error(f"Error retrieving statistics: {e}")
        return jsonify({
            "error": "Failed to retrieve statistics",
            "details": str(e)
        }), 500

@app.route("/api/stats/command-trends", methods=["GET"])
@require_api_key
def get_command_trends():
    """Get command trends over time"""
    try:
        # Get timeframe from query parameter, default to 'day'
        timeframe = request.args.get("timeframe", "day")
        
        # Determine date range and interval based on timeframe
        now = datetime.now()
        if timeframe == "hour":
            start_date = (now - timedelta(hours=1))
            interval = "minute"
            interval_minutes = 5  # 5-minute intervals
        elif timeframe == "day":
            start_date = (now - timedelta(days=1))
            interval = "hour"
            interval_minutes = 60  # 1-hour intervals
        elif timeframe == "week":
            start_date = (now - timedelta(weeks=1))
            interval = "day"
            interval_minutes = 60 * 24  # 1-day intervals
        elif timeframe == "month":
            start_date = (now - timedelta(days=30))
            interval = "day"
            interval_minutes = 60 * 24  # 1-day intervals
        else:
            start_date = (now - timedelta(days=1))
            interval = "hour"
            interval_minutes = 60  # 1-hour intervals
        
        # Generate time buckets for the interval
        time_buckets = []
        current_time = start_date
        while current_time <= now:
            time_buckets.append({
                "start": current_time,
                "end": current_time + timedelta(minutes=interval_minutes),
                "safe": 0,
                "suspicious": 0,
                "malicious": 0
            })
            current_time += timedelta(minutes=interval_minutes)
        
        # Query for commands in the time range
        query = {"timestamp": {"$gte": start_date.isoformat(), "$lte": now.isoformat()}}
        commands = list(command_logs.find(
            query,
            {"timestamp": 1, "classification.threat_level": 1}
        ))
        
        # Count commands for each time bucket and threat level
        for cmd in commands:
            cmd_time = datetime.fromisoformat(cmd["timestamp"])
            threat_level = cmd["classification"]["threat_level"]
            
            # Find which bucket this command belongs to
            for bucket in time_buckets:
                if bucket["start"] <= cmd_time < bucket["end"]:
                    bucket[threat_level] += 1
                    break
        
        # Format response
        response = {
            "timeframe": timeframe,
            "interval": interval,
            "data": [{
                "time": bucket["start"].isoformat(),
                "safe": bucket["safe"],
                "suspicious": bucket["suspicious"],
                "malicious": bucket["malicious"],
                "total": bucket["safe"] + bucket["suspicious"] + bucket["malicious"]
            } for bucket in time_buckets]
        }
        
        return jsonify(response), 200
        
    except Exception as e:
        logger.error(f"Error retrieving command trends: {e}")
        return jsonify({
            "error": "Failed to retrieve command trends",
            "details": str(e)
        }), 500

@app.route("/api/stats/geographic", methods=["GET"])
@require_api_key
def get_geographic_stats():
    """Get geographic distribution of attacks"""
    try:
        # Get timeframe from query parameter, default to 'day'
        timeframe = request.args.get("timeframe", "day")
        
        # Determine date range based on timeframe
        now = datetime.now()
        if timeframe == "hour":
            start_date = (now - timedelta(hours=1)).isoformat()
        elif timeframe == "day":
            start_date = (now - timedelta(days=1)).isoformat()
        elif timeframe == "week":
            start_date = (now - timedelta(weeks=1)).isoformat()
        elif timeframe == "month":
            start_date = (now - timedelta(days=30)).isoformat()
        else:
            start_date = (now - timedelta(days=1)).isoformat()
            
        # Query for geographic data
        pipeline = [
            {"$match": {
                "timestamp": {"$gte": start_date},
                "geo.country": {"$ne": "Unknown"},
                "geo.country": {"$exists": True}
            }},
            {"$group": {
                "_id": {
                    "country": "$geo.country",
                    "threat_level": "$classification.threat_level"
                },
                "count": {"$sum": 1},
                "latitude": {"$first": "$geo.latitude"},
                "longitude": {"$first": "$geo.longitude"}
            }},
            {"$sort": {"count": -1}}
        ]
        
        geo_data = list(command_logs.aggregate(pipeline))
        
        # Restructure the data by country
        countries = {}
        for item in geo_data:
            country_code = item["_id"]["country"]
            threat_level = item["_id"]["threat_level"]
            
            if country_code not in countries:
                countries[country_code] = {
                    "country": country_code,
                    "latitude": item["latitude"],
                    "longitude": item["longitude"],
                    "safe": 0,
                    "suspicious": 0,
                    "malicious": 0,
                    "total": 0
                }
                
            countries[country_code][threat_level] += item["count"]
            countries[country_code]["total"] += item["count"]
            
        # Prepare response
        response = {
            "timeframe": timeframe,
            "countries": list(countries.values())
        }
        
        return jsonify(response), 200
        
    except Exception as e:
        logger.error(f"Error retrieving geographic stats: {e}")
        return jsonify({
            "error": "Failed to retrieve geographic statistics",
            "details": str(e)
        }), 500

# Clean up old log entries periodically
def cleanup_old_logs():
    """Periodically clean up old log entries to maintain database size"""
    while True:
        try:
            # Keep only logs from the past MAX_QUERY_DAYS days
            cutoff_date = (datetime.now() - timedelta(days=Config.MAX_QUERY_DAYS)).isoformat()
            result = command_logs.delete_many({"timestamp": {"$lt": cutoff_date}})
            
            if result.deleted_count > 0:
                logger.info(f"Cleaned up {result.deleted_count} old log entries")
                
        except Exception as e:
            logger.error(f"Error cleaning up old logs: {e}")
            
        # Sleep for 24 hours before next cleanup
        time.sleep(24 * 60 * 60)

# Start cleanup thread if database is connected
if mongo_client and db and command_logs:
    cleanup_thread = threading.Thread(target=cleanup_old_logs, daemon=True)
    cleanup_thread.start()

if __name__ == "__main__":
    # Get port from environment or use default 5000
    port = int(os.environ.get("PORT", 5000))
    
    # Run the Flask app
    app.run(host="0.0.0.0", port=port, debug=False)
