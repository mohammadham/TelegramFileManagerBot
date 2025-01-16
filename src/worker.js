
const BOT_TOKEN = ""; // BOT_TOKEN get token from @BotFather
const BOT_WEBHOOK = "/webhook";//webhook endpoint 
const BOT_CHANNEL = "@";
const SIA_NUMBER = 564984621; // Random number for hash encoding
const HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Content-Type': 'application/json'
};
// Add KV namespace for storing file mappings
const FILE_STORE = FilmChi;
addEventListener('fetch', event => {
    event.respondWith(handleRequest(event));
});

async function handleRequest(event) {
    try {
        const url = new URL(event.request.url);
        
        if (url.pathname === BOT_WEBHOOK) {
            return handleWebhook(event);
        } else if (url.searchParams.has('file')) {
            return handleFileDownload(url);
        } else {
            return serveHomepage();
        }
    } catch (error) {
        return new Response('Error: ' + error.message, { status: 500 });
    }
}
function isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch(_) {
      return false;
    }
  }
  async function uploadFileToTelegram(chatId,fileBlob, fileExtension) {
    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("document", fileBlob, `file.${fileExtension}`);
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`;

    const response = await fetch(url, {
        method: "POST",
        body: formData
    });
    const result = await response.json();
    if (result.ok) {
        return result;
    } else {
        throw new Error('Failed to upload file to Telegram' + JSON.stringify(result));
    }
}

async function sendDocumentToTelegram(chatId, fileId, caption = '') {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`;
    const body = JSON.stringify({
        chat_id: chatId,
        document: fileId,
        caption: caption
    });

    const response = await fetch(url, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: body
    });
    return await response.json();
}

async function processUpdate(chatId, userText) {
    if (isValidUrl(userText)) {
        try {
            const fileResponse = await fetch(userText);
            const fileBlob = await fileResponse.blob();
            const fileExtension = getFileExtension(userText);
            const fileId = await uploadFileToTelegram(chatId,fileBlob, fileExtension);

            const response = await sendDocumentToTelegram(BOT_CHANNEL, fileId.result.document.file_id);
            if (response.ok) {
                return response;
            } else {
                throw new Error('Failed to upload file to Telegram' + JSON.stringify(response));
            }
        } catch (error) {
            console.error('Error processing update:', error);
            return sendTelegramMessage(chatId, 'Failed to process the file.'+error);
        }
    } else {
        const responseText = "Invalid URL!";
        return sendTelegramMessage(chatId, responseText);
    }
}

function getFileExtension(url) {
    return url.split('.').pop();
}


async function handleWebhook(event) {
    const update = await event.request.json();
    const message = update.message;
    
    if (!message || !message.chat) {
        return new Response('OK', { status: 200 });
    }

    const chatId = message.chat.id;
    let fileId, fileName, fileType,text;

    // Handle different file types
    if (message.document) {
        fileId = message.document.file_id;
        fileName = message.document.file_name;
        fileType = message.document.mime_type;
        text = message.caption || '';
    } else if (message.photo) {
        const photo = message.photo[message.photo.length - 1];
        fileId = photo.file_id;
        fileName = message.photo.file_name||`photo_${Date.now()}.jpg`;
        fileType = message.photo.mime_type||'image/jpeg';
        text = message.caption || '';
    } else if (message.video) {
        fileId = message.video.file_id;
        fileName = message.video.file_name || `video_${Date.now()}.mp4`;
        fileType = message.video.mime_type;
        text = message.caption || '';
    } else if (message.audio) {
        fileId = message.audio.file_id;
        fileName = message.audio.file_name || `audio_${Date.now()}.mp3`;
        fileType = message.audio.mime_type;
        text = message.caption || '';
    } else if (message.voice) {
        fileId = message.voice.file_id;
        fileName = `voice_${Date.now()}.ogg`;
        fileType = 'audio/ogg';
        text = message.caption || '';
    } else if (message.text) {
        text = message.text;
        const urlPattern = /(https?:\/\/[^\s]+)/g;
        const urls = message.text.match(urlPattern);
        if (urls && urls.length > 0) {
            const downloadUrl = urls[0];
            // const fileDownloadResponse = await fetch(downloadUrl);
            // const fileBlob = await fileDownloadResponse.blob();
            // const fileBuffer = await fileBlob.arrayBuffer();
            // const file = new File([fileBuffer], `downloaded_file`, { type: fileDownloadResponse.headers.get('Content-Type') });
            try{
                const file = await processUpdate(chatId,downloadUrl);
            
                //  return sendTelegramMessage(chatId, JSON.stringify(file));
            
                        // Save file to channel
                        // const savedMsg = await sendToChannel(BOT_CHANNEL, file,file.type);
                        if (!file.ok) {
                            return sendTelegramMessage(chatId, JSON.stringify(file));
                        }
                        fileId = file.result.document.file_id;
                        fileName = file.result.document.file_name;
                        fileType = file.result.document.mime_type;
                        // Generate hash for the file
                        const hash = await generateHash(fileId+Date.now());
            
                        // Store file info in KV
                        await FILE_STORE.put(hash, JSON.stringify({
                            fileId: fileId,
                            fileName:fileName,
                            fileType: fileType,
                            timestamp: Date.now(),
                            messageId: file.result.message_id,
                            text: text
                        }));
                        const downloadLink = `${new URL(event.request.url).origin}/?file=${hash}`;
            
                        return sendTelegramMessage(
                            chatId,
                            `File saved successfully!\nDownload link: ${downloadLink}`
                        );
        }catch(e)
        {
            return sendTelegramMessage(chatId, "Failed to save file ." + e.toString());
        }

        } else {
            return sendTelegramMessage(chatId, "Please send a file, photo, video, or a valid link.");
        }
    } else {
        return sendTelegramMessage(chatId, "Please send a file, photo, video, or a valid link.");
    }
    if (fileId) {
    // Save file to channel
    const savedMsg = await sendToChannel(BOT_CHANNEL, fileId,fileType,text);
    // sendTelegramMessage(chatId, JSON.stringify(savedMsg));
    if (!savedMsg.ok) {
        return sendTelegramMessage(chatId, "Failed to save file.");
    }

    // Generate download link
    // const hash = generateHash(savedMsg.result.message_id);
            // Generate hash for the file
            const hash = await generateHash(fileId + Date.now());
        
            // Store file info in KV
            await FILE_STORE.put(hash, JSON.stringify({
                fileId,
                fileName,
                fileType,
                timestamp: Date.now(),
                messageId:savedMsg.result.message_id,
                text: text
            }));
    const downloadLink = `${new URL(event.request.url).origin}/?file=${hash}`;
    
    return sendTelegramMessage(
        chatId,
        `File saved successfully!\nDownload link: ${downloadLink}`
    );
    }
    return new Response('OK', { status: 200 });
}

async function handleFileDownload(url) {
    try {
        const hash = url.searchParams.get('file');
        // const messageId = decodeHash(hash);
        

    // Get file info from KV
    const file = await FILE_STORE.get(hash);
    if (!file) {
        return new Response('File not found', { status: 404 });
    }
    const { fileId, fileName, fileType,messageId } = JSON.parse(file);
        const fileInfo = await getFileFromChannel(BOT_CHANNEL, messageId,fileId);
        
        if (!fileInfo) {
            return new Response('File not available', { status: 404 });
        }
        const fileData = await fetchTelegramFile(fileInfo.file_id);
        return new Response(fileData, {
            headers: {
                'Content-Type': fileInfo.mime_type,
                'Content-Disposition': `attachment; filename="${fileInfo.file_name}"`
            }
        });
    } catch (error) {
        return new Response('Error accessing file', { status: 500 });
    }
}

function serveHomepage() {
    const html = `
        <!DOCTYPE html>
        <html>
            <head>
                <title>Telegram File Manager</title>
                <style>
                    body { font-family: Arial; max-width: 800px; margin: 0 auto; padding: 20px; }
                    .container { text-align: center; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Telegram File Manager</h1>
                    <p>Send files to our bot to get permanent download links!</p>
                    <p>Bot Username: @YourBotUsername</p>
                </div>
            </body>
        </html>
    `;
    return new Response(html, {
        headers: { 'Content-Type': 'text/html' }
    });
}

// Utility functions
// function generateHash(messageId) {
//     return btoa(`${messageId * SIA_NUMBER}`).replace(/=/g, '');
// }
async function generateHash(input) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input + SIA_NUMBER.toString());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substr(0, 16);
}

// function decodeHash(hash) {
//     return parseInt(atob(hash)) / SIA_NUMBER;
// }

async function sendTelegramMessage(chatId, text) {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML'
        })
    });
    return new Response('OK', { status: 200 });
}

async function sendToChannel(channelId, file ,fileType , caption = '') {
    

    if (fileType.startsWith('image/')) {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: channelId,
                photo: file,
                caption :caption
            })
        });
        return await response.json();
    } else if (fileType.startsWith('audio/')) {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendAudio`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: channelId,
                audio: file,
                caption :caption
            })
        });
        return await response.json();
    } else if (fileType === 'video/') {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: channelId,
                video: file,
                caption :caption
            })
        });
        return await response.json();
    } else {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: channelId,
                document: file,
                caption :caption
            })
        });
        return await response.json();
    }

}

async function getFileFromChannel(channelId, messageId,fileid) {
  try {
// const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile`, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({
//         chat_id: channelId,
//         message_id: messageId
//     })
// });
const response = await getFile(fileid);
// const data = await response.json();
      
// if (!data.ok || !data.result) {
//     return null;
// }
if (response.error_code){return response}
// Return file path from Telegram
return {
    // file_path: data.result.file_path,
    file_path:response.file_path,
    file_id: response.file_id,
    mime_type: response.mime_type,
    file_size: response.file_size,
    file_name: response.file_name
};
} catch (error) {
console.error('Error getting file:', error);
return null;
}
}

async function fetchTelegramFile(fileId) {
    const fileInfo = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
    const { result } = await fileInfo.json();
    const filePath = result.file_path;
    
    const fileResponse = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`);
    return await fileResponse.arrayBuffer();
}
function apiUrl (methodName, params = null) {
    let query = ''
    if (params) {query = '?' + new URLSearchParams(params).toString()}
    return `https://api.telegram.org/bot${BOT_TOKEN}/${methodName}${query}`
}
async function getFile(file_id) {
    const response = await fetch(apiUrl('getFile', {file_id: file_id}))
    if (response.status == 200) {return (await response.json()).result;
    } else {return await response.json()}
}

async function fetchFile(file_path) {
    const file = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${file_path}`);
    return await file.arrayBuffer()
}
// support link for downloaded files
async function handleDocument(botToken, document) {
    const fileId = document.file_id
    const fileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
    const fileResponse = await fetch(fileUrl)
    const fileData = await fileResponse.json()
  
    if (!fileData.ok) {
      return new Response('Failed to fetch file info', { status: 500 })
    }
  
    const filePath = fileData.result.file_path
    const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`
    const fileDownloadResponse = await fetch(downloadUrl)
    const fileBlob = await fileDownloadResponse.blob()
  
    return new Response(fileBlob, {
      headers: {
        'Content-Disposition': `attachment; filename=${document.file_name}`,
        'Content-Type': document.mime_type
      }
    })
  }
  
  async function handleLink(text) {
    const urlPattern = /(https?:\/\/[^\s]+)/g
    const urls = text.match(urlPattern)
    if (urls && urls.length > 0) {
      const downloadUrl = urls[0]
      const fileDownloadResponse = await fetch(downloadUrl)
      const fileBlob = await fileDownloadResponse.blob()
  
      return new Response(fileBlob, {
        headers: {
          'Content-Disposition': 'attachment; filename=downloaded_file',
          'Content-Type': fileDownloadResponse.headers.get('Content-Type')
        }
      })
    }
    return new Response('No valid link found', { status: 404 })
  }