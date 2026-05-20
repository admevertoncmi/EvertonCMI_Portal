"use client";

import React, { useState, useEffect, useRef } from 'react';

interface ScaledGoogleDrivePlayerProps {
  url: string;
  zoomMode: 'fit' | 'fill';
  aspectRatio: '9/16' | 'video' | 'square';
}

const getEmbedUrl = (url: string) => {
  if (!url) return null;
  try {
    const ytMatch = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/.exec(url);
    if (ytMatch?.[1]) return `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`;
    if (url.includes('/preview') || url.includes('embeddedfolderview')) return url;
    const folderMatch = /\/folders\/([a-zA-Z0-9_-]+)/.exec(url);
    if (folderMatch?.[1]) return `https://drive.google.com/embeddedfolderview?id=${folderMatch[1]}#grid`;
    const driveMatch1 = /\/file\/d\/([a-zA-Z0-9_-]+)/.exec(url);
    if (driveMatch1?.[1]) return `https://drive.google.com/file/d/${driveMatch1[1]}/preview`;
    const driveMatch2 = /id=([a-zA-Z0-9_-]+)/.exec(url);
    if (driveMatch2?.[1] && url.includes('drive.google.com')) return `https://drive.google.com/file/d/${driveMatch2[1]}/preview`;
    return null;
  } catch (error) { return null; }
};

export const ScaledGoogleDrivePlayer: React.FC<ScaledGoogleDrivePlayerProps> = ({
  url,
  zoomMode,
  aspectRatio,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    // Set initial measured width
    setContainerWidth(element.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });

    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  let virtualWidth = 1024;
  let virtualHeight = 576;
  if (aspectRatio === '9/16') {
    virtualWidth = 576;
    virtualHeight = 1024;
  } else if (aspectRatio === 'square') {
    virtualWidth = 1024;
    virtualHeight = 1024;
  }

  // Pure unitless scaling factor
  const scale = containerWidth > 0 ? containerWidth / virtualWidth : 1;

  const cropTop = zoomMode === 'fill' ? 60 : 0;
  const cropBottom = zoomMode === 'fill' ? 60 : 0;
  const iframeHeight = virtualHeight + cropTop + cropBottom;
  const embedUrl = getEmbedUrl(url) || url;

  return (
    <div 
      ref={containerRef} 
      className="absolute inset-0 w-full h-full overflow-hidden bg-black flex items-center justify-center rounded-[24px]"
    >
      {containerWidth > 0 && (
        <div 
          className="relative overflow-hidden"
          style={{
            width: `${virtualWidth}px`,
            height: `${virtualHeight}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        >
          <iframe 
            title="Vídeo Google Drive" 
            src={embedUrl} 
            className="absolute border-0 w-full" 
            style={{
              width: `${virtualWidth}px`,
              height: `${iframeHeight}px`,
              top: `-${cropTop}px`,
              left: 0,
            }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
};
