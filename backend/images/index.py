import json
import os
import psycopg2
import base64
import uuid
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Управление изображениями (GET для получения списка, POST для загрузки)
    Args: event - dict with httpMethod, body
          context - object with request_id
    Returns: HTTP response dict with images data
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    database_url = os.environ.get('DATABASE_URL')
    conn = psycopg2.connect(database_url)
    cursor = conn.cursor()
    
    if method == 'GET':
        cursor.execute('SELECT id, file_name, file_url, created_at FROM images ORDER BY created_at DESC')
        rows = cursor.fetchall()
        
        images = []
        for row in rows:
            images.append({
                'id': row[0],
                'file_name': row[1],
                'file_url': row[2],
                'created_at': row[3].isoformat() if row[3] else None
            })
        
        cursor.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'images': images}),
            'isBase64Encoded': False
        }
    
    if method == 'POST':
        body_data = json.loads(event.get('body', '{}'))
        file_name = body_data.get('file_name')
        file_data = body_data.get('file_data')
        
        if not file_name or not file_data:
            cursor.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'file_name and file_data required'}),
                'isBase64Encoded': False
            }
        
        file_url = file_data
        
        cursor.execute(
            'INSERT INTO images (file_name, file_url) VALUES (%s, %s) RETURNING id, file_name, file_url, created_at',
            (file_name, file_url)
        )
        
        row = cursor.fetchone()
        conn.commit()
        
        image = {
            'id': row[0],
            'file_name': row[1],
            'file_url': row[2],
            'created_at': row[3].isoformat() if row[3] else None
        }
        
        cursor.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'image': image}),
            'isBase64Encoded': False
        }
    
    cursor.close()
    conn.close()
    
    return {
        'statusCode': 405,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({'error': 'Method not allowed'}),
        'isBase64Encoded': False
    }
