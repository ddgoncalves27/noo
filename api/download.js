export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { url } = req.body;
        
        if (!url || !isValidTikTokUrl(url)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid TikTok URL' 
            });
        }
        
        // Get the HIGHEST QUALITY video
        const videoData = await extractBestQuality(url);
        
        return res.status(200).json({
            success: true,
            ...videoData
        });
        
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to extract video' 
        });
    }
}

function isValidTikTokUrl(url) {
    return url.includes('tiktok.com') || 
           url.includes('vm.tiktok.com') || 
           url.includes('vt.tiktok.com');
}

async function extractBestQuality(url) {
    // Method 1: Try TikWM API (gets source quality)
    try {
        const tikwmUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;
        const response = await fetch(tikwmUrl);
        
        if (response.ok) {
            const data = await response.json();
            if (data.code === 0 && data.data) {
                const video = data.data;
                
                // Get highest quality URL (hdplay or play)
                const hdUrl = video.hdplay || video.play;
                const musicUrl = video.music || video.music_info?.play;
                
                return {
                    downloadUrl: hdUrl,
                    quality: video.hdplay ? `${video.width}x${video.height} HD` : `${video.width}x${video.height}`,
                    size: video.size ? `${(video.size / 1048576).toFixed(1)} MB` : 'Unknown',
                    bitrate: video.bitrate ? `${(video.bitrate / 1000).toFixed(0)} kbps` : 'Original',
                    codec: 'h264',
                    duration: video.duration ? `${video.duration}s` : null,
                    filename: `tiktok_${video.id}_HD.mp4`,
                    musicUrl: musicUrl,
                    cover: video.cover
                };
            }
        }
    } catch (e) {
        console.log('TikWM failed:', e.message);
    }

    // Method 2: Try MusicalDown (another reliable source)
    try {
        const musicaldownUrl = 'https://musicaldown.com/api/download';
        const formData = new URLSearchParams();
        formData.append('url', url);
        
        const response = await fetch(musicaldownUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            if (data.status === 'success' && data.data) {
                // Get the no-watermark HD version
                const hdVideo = data.data.video_no_watermark_hd || data.data.video_no_watermark;
                
                return {
                    downloadUrl: hdVideo,
                    quality: data.data.video_no_watermark_hd ? 'Original HD' : 'HD',
                    size: 'Variable',
                    bitrate: 'Original',
                    codec: 'h264',
                    filename: `tiktok_original_hd.mp4`
                };
            }
        }
    } catch (e) {
        console.log('MusicalDown failed:', e.message);
    }

    // Method 3: SnapTik as backup
    try {
        const response = await fetch('https://api.tiklydown.eu.org/api/download/v3', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.result) {
                // Try to get HD version first
                const videoUrl = data.result.hdVideo || data.result.video;
                
                return {
                    downloadUrl: videoUrl,
                    quality: data.result.hdVideo ? 'HD' : 'Standard',
                    size: data.result.size || 'Unknown',
                    bitrate: 'High',
                    codec: 'h264',
                    filename: 'tiktok_video_hd.mp4'
                };
            }
        }
    } catch (e) {
        console.log('TiklyDown failed:', e.message);
    }
    
    throw new Error('Unable to extract video. TikTok might have updated their system.');
}
