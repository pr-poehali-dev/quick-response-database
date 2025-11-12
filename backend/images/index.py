import json
import os
import psycopg2
import psycopg2.extras
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
                'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    database_url = os.environ.get('DATABASE_URL')
    
    try:
        conn = psycopg2.connect(database_url)
        conn.autocommit = True
        cursor = conn.cursor()
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': f'Database connection failed: {str(e)}'}),
            'isBase64Encoded': False
        }
    
    if method == 'GET':
        params = event.get('queryStringParameters', {})
        image_id = params.get('id')
        
        if image_id:
            # Получить конкретное изображение с данными
            cursor.execute(f'SELECT id, file_name, file_url, created_at FROM images WHERE id = {int(image_id)}')
            row = cursor.fetchone()
            
            if not row:
                cursor.close()
                conn.close()
                return {
                    'statusCode': 404,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': 'Image not found'}),
                    'isBase64Encoded': False
                }
            
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
        else:
            # Получить список всех изображений БЕЗ данных (только метаданные)
            cursor.execute('SELECT id, file_name, created_at FROM images ORDER BY created_at DESC')
            rows = cursor.fetchall()
            
            images = []
            for row in rows:
                images.append({
                    'id': row[0],
                    'file_name': row[1],
                    'file_url': None,  # Не возвращаем данные в списке
                    'created_at': row[2].isoformat() if row[2] else None
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
        
        # Используем простой запрос без параметров
        safe_file_name = file_name.replace("'", "''")
        safe_file_url = file_url.replace("'", "''")
        
        cursor.execute(
            f"INSERT INTO images (file_name, file_url) VALUES ('{safe_file_name}', '{safe_file_url}') RETURNING id, file_name, file_url, created_at"
        )
        
        row = cursor.fetchone()
        
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
    
    if method == 'DELETE':
        params = event.get('queryStringParameters', {})
        image_id = params.get('id')
        
        if not image_id:
            cursor.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'id required'}),
                'isBase64Encoded': False
            }
        
        # Используем простой запрос без параметров
        cursor.execute(f"DELETE FROM images WHERE id = {int(image_id)}")
        
        cursor.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'success': True}),
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