import json
import os
import psycopg2
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Управление ячейками таблицы проекта (GET для получения, POST для сохранения, синхронизация всех данных)
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
        params = event.get('queryStringParameters', {}) or {}
        action = params.get('action')
        
        if action == 'get_columns':
            cursor.execute('SELECT tab_id, col_index, name FROM column_names')
            rows = cursor.fetchall()
            
            column_names = {}
            for row in rows:
                tab_id = str(row[0])
                col_index = row[1]
                name = row[2]
                
                if tab_id not in column_names:
                    column_names[tab_id] = {}
                column_names[tab_id][col_index] = name
            
            cursor.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'columnNames': column_names}),
                'isBase64Encoded': False
            }
        
        tab_id = params.get('tab_id')
        
        if not tab_id:
            cursor.execute('SELECT id, tab_id, row_index, col_index, content, header FROM cells')
        else:
            cursor.execute(
                f'SELECT id, tab_id, row_index, col_index, content, header FROM cells WHERE tab_id = {int(tab_id)}'
            )
        
        rows = cursor.fetchall()
        
        cells = []
        for row in rows:
            cells.append({
                'id': row[0],
                'tab_id': row[1],
                'row_index': row[2],
                'col_index': row[3],
                'content': row[4],
                'header': row[5] or ''
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
        action = body_data.get('action')
        
        if action == 'sync_all':
            cells_data = body_data.get('cells', [])
            column_names_data = body_data.get('columnNames', {})
            
            cursor.execute('DELETE FROM cells')
            cursor.execute('DELETE FROM column_names')
            
            for cell in cells_data:
                if cell.get('content'):
                    safe_content = cell['content'].replace("'", "''")
                    safe_header = cell.get('header', '').replace("'", "''")
                    cursor.execute(
                        f'''
                        INSERT INTO cells (tab_id, row_index, col_index, content, header, updated_at)
                        VALUES ({int(cell['tab_id'])}, {int(cell['row_index'])}, {int(cell['col_index'])}, '{safe_content}', '{safe_header}', CURRENT_TIMESTAMP)
                        '''
                    )
            
            for tab_id_str, columns in column_names_data.items():
                tab_id = int(tab_id_str)
                for col_index, name in columns.items():
                    safe_name = name.replace("'", "''")
                    cursor.execute(
                        f'''
                        INSERT INTO column_names (tab_id, col_index, name, updated_at)
                        VALUES ({tab_id}, {int(col_index)}, '{safe_name}', CURRENT_TIMESTAMP)
                        '''
                    )
            
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
        
        tab_id = body_data.get('tab_id')
        row_index = body_data.get('row_index')
        col_index = body_data.get('col_index')
        content = body_data.get('content', '')
        header = body_data.get('header', '')
        
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
        safe_header = header.replace("'", "''")
        
        cursor.execute(
            f'''
            INSERT INTO cells (tab_id, row_index, col_index, content, header, updated_at)
            VALUES ({int(tab_id)}, {int(row_index)}, {int(col_index)}, '{safe_content}', '{safe_header}', CURRENT_TIMESTAMP)
            ON CONFLICT (tab_id, row_index, col_index)
            DO UPDATE SET content = EXCLUDED.content, header = EXCLUDED.header, updated_at = CURRENT_TIMESTAMP
            RETURNING id, tab_id, row_index, col_index, content, header
            '''
        )
        
        row = cursor.fetchone()
        
        cell = {
            'id': row[0],
            'tab_id': row[1],
            'row_index': row[2],
            'col_index': row[3],
            'content': row[4],
            'header': row[5] or ''
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