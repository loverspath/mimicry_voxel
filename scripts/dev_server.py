#!/usr/bin/env python3
"""
scripts/dev_server.py
Lightweight HTTP development server for Mimicry Roguelike.
Features:
- Disables caching completely (Cache-Control: no-cache, no-store, must-revalidate)
- Enables CORS (Access-Control-Allow-Origin: *)
- Real-time formatted access/error logging with timestamps
- Clean process/socket management with SO_REUSEADDR
"""

import sys
import os
import argparse
import socketserver
from http.server import SimpleHTTPRequestHandler
from datetime import datetime

class NoCacheCORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Disable browser cache completely
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        # Enable full CORS
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_POST(self):
        if self.path == '/api/save_debug':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_length)
                
                # Ensure logs directory exists
                project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
                logs_dir = os.path.join(project_root, 'logs')
                os.makedirs(logs_dir, exist_ok=True)
                
                target_file = os.path.join(logs_dir, 'debug_save.json')
                with open(target_file, 'wb') as f:
                    f.write(body)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                response = '{"success": true, "message": "Debug save saved successfully", "path": "logs/debug_save.json"}'
                self.wfile.write(response.encode('utf-8'))
                print(f"💾 [Debug Save] Successfully saved {len(body)} bytes to {target_file}")
                return
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                response = f'{{"success": false, "error": "{str(e)}"}}'
                self.wfile.write(response.encode('utf-8'))
                return
        
        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        client_ip = self.client_address[0]
        sys.stderr.write(f"[{timestamp}] [{client_ip}] {format % args}\n")
        sys.stderr.flush()

class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True

def run_server(host='0.0.0.0', port=8080, directory=None):
    if directory is None:
        # Default to the parent directory of this script (mimicry_voxel root)
        directory = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    
    os.chdir(directory)
    
    handler = lambda *args, **kwargs: NoCacheCORSRequestHandler(*args, directory=directory, **kwargs)
    
    print(f"==================================================")
    print(f"🚀 Mimicry Roguelike Dev Server Starting...")
    print(f"📁 Serving Directory: {directory}")
    print(f"🌐 Host: {host} | Port: {port}")
    print(f"⚡ Features: No-Cache Headers, CORS (*), Live Logging")
    print(f"🔗 Local URL: http://127.0.0.1:{port}/")
    print(f"==================================================")
    sys.stdout.flush()

    with ReusableTCPServer((host, port), handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Dev Server shutting down gracefully.")
            httpd.shutdown()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Mimicry Roguelike No-Cache Dev Server')
    parser.add_argument('positional_port', nargs='?', type=int, default=None, help='Optional positional port number (e.g. 8080)')
    parser.add_argument('--host', default='0.0.0.0', help='Host address (default: 0.0.0.0)')
    parser.add_argument('--port', type=int, default=None, help='Port number (default: 8080)')
    parser.add_argument('--dir', default=None, help='Directory to serve (default: mimicry_voxel root)')
    args = parser.parse_args()
    
    selected_port = args.port or args.positional_port or 8080
    run_server(host=args.host, port=selected_port, directory=args.dir)
