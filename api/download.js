export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Only accept POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { url } = req.body;
        
        if (!url || (!url.includes('tiktok.com') && !url.includes('vm.tiktok.com') && !url.includes('vt.tiktok.com'))) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid TikTok URL' 
            });
        }
        
        // Get the original video
        const videoData = await getOriginalVideo(url);
        
        return res.status(200).json({
            success: true,
            downloadUrl: videoData.url,
            quality: videoData.quality,
            size: videoData.size,
            bitrate: videoData.bitrate,
            codec: videoData.codec,
            filename: videoData.filename
        });
        
    } catch (error) {
        console.error('Download error:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Failed to extract video. Please try again.' 
        });
    }
}

async function getOriginalVideo(url) {
    const videoId = extractVideoId(url);
    
    // Try multiple extraction methods
    
    // Method 1: Direct API
    try {
        const apiUrl = `https://api16-normal-c-useast1a.tiktokv.com/aweme/v1/feed/?aweme_id=${videoId}`;
        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'com.zhiliaoapp.musically/2022600030 (Linux; U; Android 7.1.2; es_ES; SM-G988N; Build/NRD90M.G988NKSU1AQDC)'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.aweme_list && data.aweme_list[0]) {
                const video = data.aweme_list[0].video;
                const urls = video.play_addr.url_list;
                const hdUrl = urls.find(u => !u.includes('watermark')) || urls[0];
                
                return {
                    url: hdUrl,
                    quality: `${video.width}x${video.height}`,
                    bitrate: `${(video.bit_rate / 1000000).toFixed(2)} Mbps`,
                    size: calculateSize(video.bit_rate, video.duration / 1000),
                    codec: 'h264',
                    filename: `tiktok_${videoId}_${video.width}x${video.height}.mp4`
                };
            }
        }
    } catch (e) {
        console.log('Method 1 failed:', e.message);
    }
    
    // Method 2: Web scraping
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            }
        });
        
        const html = await response.text();
        const videoUrlMatch = html.match(/"playAddr":"([^"]+)"/);
        const widthMatch = html.match(/"width":(\d+)/);
        const heightMatch = html.match(/"height":(\d+)/);
        
        if (videoUrlMatch) {
            const videoUrl = videoUrlMatch[1].replace(/\\u002F/g, '/');
            return {
                url: videoUrl,
                quality: widthMatch && heightMatch ? `${widthMatch[1]}x${heightMatch[1]}` : 'HD',
                bitrate: 'Original',
                size: 'Variable',
                codec: 'h264',
                filename: `tiktok_${videoId}.mp4`
            };
        }
    } catch (e) {
        console.log('Method 2 failed:', e.message);
    }
    
    // Method 3: Reliable API fallback
    try {
        const apiUrl = 'https://api.tiklydown.eu.org/api/download/v3';
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.result && data.result.video) {
                return {
                    url: data.result.video,
                    quality: data.result.quality || 'HD',
                    bitrate: 'Original',
                    size: data.result.size || 'Unknown',
                    codec: 'h264',
                    filename: `tiktok_${videoId}.mp4`
                };
            }
        }
    } catch (e) {
        console.log('Method 3 failed:', e.message);
    }
    
    throw new Error('All extraction methods failed');
}

function extractVideoId(url) {
    const patterns = [
        /tiktok\.com\/@[\w.-]+\/video\/(\d+)/,
        /tiktok\.com\/v\/(\d+)/,
        /vm\.tiktok\.com\/([\w]+)/,
        /vt\.tiktok\.com\/([\w]+)/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    
    return Date.now().toString();
}

function calculateSize(bitrate, duration) {
    if (!bitrate || !duration) return 'Unknown';
    const sizeInMB = (bitrate * duration) / 8 / 1024 / 1024;
    return `${sizeInMB.toFixed(1)} MB`;
}