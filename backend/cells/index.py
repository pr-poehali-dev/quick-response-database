import json
import os
import psycopg2
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Управление ячейками таблицы (GET для получения, POST для сохранения)
    Args: event - dict with httpMethod, queryStringParameters, body
          context - object with request_id
    Returns: HTTP response dict with cells data
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
        tab_id = params.get('tab_id')
        
        if not tab_id:
            cursor.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'tab_id required'}),
                'isBase64Encoded': False
            }
        
        cursor.execute(
            f'SELECT id, tab_id, row_index, col_index, content FROM cells WHERE tab_id = {int(tab_id)}'
        )
        rows = cursor.fetchall()
        
        cells = []
        for row in rows:
            cells.append({
                'id': row[0],
                'tab_id': row[1],
                'row_index': row[2],
                'col_index': row[3],
                'content': row[4]
            })
        
        cursor.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'cells': cells}),
            'isBase64Encoded': False
        }
    
    if method == 'POST':
        body_data = json.loads(event.get('body', '{}'))
        tab_id = body_data.get('tab_id')
        row_index = body_data.get('row_index')
        col_index = body_data.get('col_index')
        content = body_data.get('content', '')
        
        if tab_id is None or row_index is None or col_index is None:
            cursor.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'tab_id, row_index, col_index required'}),
                'isBase64Encoded': False
            }
        
        safe_content = content.replace("'", "''")
        
        cursor.execute(
            f'''
            INSERT INTO cells (tab_id, row_index, col_index, content, updated_at)
            VALUES ({int(tab_id)}, {int(row_index)}, {int(col_index)}, '{safe_content}', CURRENT_TIMESTAMP)
            ON CONFLICT (tab_id, row_index, col_index)
            DO UPDATE SET content = EXCLUDED.content, updated_at = CURRENT_TIMESTAMP
            RETURNING id, tab_id, row_index, col_index, content
            '''
        )
        
        row = cursor.fetchone()
        
        cell = {
            'id': row[0],
            'tab_id': row[1],
            'row_index': row[2],
            'col_index': row[3],
            'content': row[4]
        }
        
        cursor.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'cell': cell}),
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