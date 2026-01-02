from flask import Flask, request, jsonify
import io
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload, MediaIoBaseUpload
from google.oauth2.service_account import Credentials
from PIL import Image, ImageDraw, ImageFont
import os
import logging
import math
import traceback

app = Flask(__name__)

SCOPES = ['https://www.googleapis.com/auth/drive']
SERVICE_ACCOUNT_FILE = 'glass-timing-454616-i9-4da22fca1f4c.json'

credentials = Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES
)
drive_service = build('drive', 'v3', credentials=credentials)


def process_images(folder_id, timestamp):
    try:
        query = f"'{folder_id}' in parents and trashed = false"
        results = drive_service.files().list(q=query).execute()
        files = results.get('files', [])

        for file in files:
            if 'image' in file.get('mimeType', '') and not '.'.join(file['name'].split('.')[:-1]).endswith('_timestamp'):
                print("File que coincide con timestamp y con image: ",file)
                request = drive_service.files().get_media(fileId=file['id'])
                file_stream = io.BytesIO()
                downloader = MediaIoBaseDownload(file_stream, request)

                done = False
                while not done:
                    status, done = downloader.next_chunk()
                file_stream.seek(0)

                img = Image.open(file_stream)
                draw = ImageDraw.Draw(img)
                image_width, image_height = img.size

                if image_width > image_height:
                    text_width_target = image_width/3 
                    # return f"La imagen es horizontal, text width target: {text_width_target}"
                else:
                    text_width_target = image_width/2 
                    # return f"La imagen es vertical, text width target: {text_width_target}"

                font_size = 10
                last_font_size = font_size
                font = ImageFont.load_default(size=font_size) #truetype("arial.ttf")
                
                while True:
                    font = ImageFont.load_default(size=font_size) # truetype("arial.ttf",font_size)
                    bbox = draw.textbbox((0, 0), timestamp, font=font)
                    text_width = bbox[2] - bbox[0]
                    # text_height = bbox[3] - bbox[1]

                    # print(f"Font size: {font_size}, Text width: {text_width}")
                    # print("Text width target: ", text_width_target)

                    if text_width >= text_width_target or font_size > 200:
                        if text_width > text_width_target:
                            font_size = last_font_size
                        break

                    last_font_size = font_size

                    # font_size += 1

                    # Ajustar tamaño de paso dinámico
                    step = max(1, (text_width_target - text_width) // 20)
                    font_size += step

                # Position the text
                text_x = image_width - text_width - 10
                text_y = 10

                # Draw text with border for better visibility
                border_thickness = 3
                for offset_x in range(-border_thickness, border_thickness + 1):
                    for offset_y in range(-border_thickness, border_thickness + 1):
                        # print("Entra a dibujar el texto con borde")
                        draw.text((text_x + offset_x, text_y + offset_y), timestamp, font=font, fill="white")

                # print("Dibuja el texto")
                draw.text((text_x, text_y), timestamp, font=font, fill="black")

                # En caso tenga un canal adicional (RGBA por ejemplo), se convierte a RGB
                if img.mode != "RGB":
                    img = img.convert("RGB")

                output = io.BytesIO()
                img.save(output, format='JPEG')
                output.seek(0)

                new_name = f"{file['name'].rsplit('.', 1)[0]}_timestamp.{file['name'].rsplit('.', 1)[1]}"
                media = MediaIoBaseUpload(output, mimetype=file['mimeType'], resumable=True)
                # print(media)

                drive_service.files().create(
                    body={'name': new_name, 'parents': [folder_id]},
                    media_body=media
                ).execute()

    except Exception as e:
        traceback.print_exc()
        return str(e)

@app.route('/', methods=['POST'])
def handle_request():
    folder_id = request.form['folder_id']
    timestamp = request.form['timestamp']

    if not folder_id or not timestamp:
        return jsonify({'error': 'Missing parameters'}), 400

    try:
        process_images(folder_id, timestamp)
        return jsonify({'status': 'success'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# folder_id = "1Xn7b0E_4GzgtQPJCoRJQdYSF8jQk8SHX"
# timestamp = "19-01-2025 19:56:00"

# hola = process_images(folder_id,timestamp)
# print(hola)
# process_images(folder_id,timestamp)

if __name__ == '__main__':
#     logging.basicConfig(level=logging.DEBUG)
    app.run(debug=True, host="0.0.0.0", port=8080)
