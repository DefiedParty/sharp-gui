import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/store/useAppStore';
import { DownloadIcon } from '@/components/common/Icons';
import styles from './ImageViewer.module.css';

// SVG icons for closing since we only have DownloadIcon in our current Icons.tsx
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

export function ImageViewer() {
  const { previewImage, setPreviewImage } = useAppStore();
  const { t } = useTranslation();
  
  const [isClosing, setIsClosing] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const overlayRef = useRef<HTMLDivElement>(null);

  // --- Zoom & Pan State ---
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const { scale, x, y } = transform;
  const [isDragging, setIsDragging] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const isMoved = useRef(false); // To track if we dragged vs just clicked
  const startPos = useRef({ x: 0, y: 0, posX: 0, posY: 0, dist: 0, scale: 1 });
  const wheelTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && previewImage) {
        handleClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewImage]);

  // Lock body scroll and reset states when opened
  useEffect(() => {
    if (previewImage) {
      document.body.style.overflow = 'hidden';
      setIsLoaded(false);
      setIsClosing(false);
      setIsDownloading(false);
      setTransform({ scale: 1, x: 0, y: 0 });
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [previewImage]);

  // --- Wheel to Zoom ---
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !previewImage) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault(); // Prevent page scroll
      
      const isTrackpadPinch = e.ctrlKey;
      let delta = e.deltaY;
      
      // Much softer, more elegant zoom sensitivity
      const zoomSensitivity = isTrackpadPinch ? 0.005 : 0.0015;

      setTransform((prev) => {
        // 计算阻尼：如果当前处于 <1 的状态，或者是正要缩小到 <1 区域，施加极强的弹性阻力拉拽感
        // 这样基于 delta 的惩罚能绝对防止状态在放大缩小间来回数学震荡，实现完美的跟手感
        const isShrinkingBelowOne = prev.scale < 1 || (prev.scale === 1 && delta > 0);
        const penalty = isShrinkingBelowOne ? 0.15 : 1;
        
        // 基于受到惩罚的滚动量，计算当前应当缩放倍数
        const scaleMultiplier = Math.exp(-delta * zoomSensitivity * penalty);
        
        let newScale = prev.scale * scaleMultiplier;
        
        // 绝对底线和上限保护，防止被过度无限缩小或放大
        // 不要让它缩小到 0.85 以下，否则缩小太多回弹的时候太突兀
        newScale = Math.min(Math.max(newScale, 0.85), 8);
        
        const actualRatio = newScale / prev.scale;
        
        // Let cursor be the zoom origin 
        // We calculate point of cursor relative to screen center
        const cx = e.clientX - window.innerWidth / 2;
        const cy = e.clientY - window.innerHeight / 2;

        const dx = cx - prev.x;
        const dy = cy - prev.y;

        return {
          scale: newScale,
          x: prev.x - dx * (actualRatio - 1),
          y: prev.y - dy * (actualRatio - 1)
        };
      });

      // Debounce snap-back for rubber banding to 1
      if (wheelTimeout.current) clearTimeout(wheelTimeout.current);
      wheelTimeout.current = setTimeout(() => {
        setTransform((prev) => {
          // If the user scaled it smaller than 1, let's gracefully bounce it back
          if (prev.scale < 1) {
            return { scale: 1, x: 0, y: 0 };
          }
          // If the user panned the image while zoomed out, don't snap the pan!
          return prev;
        });
      }, 250); // increased debounce to outlast trackpad momentum
    };

    overlay.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      overlay.removeEventListener('wheel', handleWheel);
      if (wheelTimeout.current) clearTimeout(wheelTimeout.current);
    };
  }, [previewImage]);

  // --- Touch (Pinch & Pan) ---
  const getDistance = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    isMoved.current = false;
    if (e.touches.length === 2) {
      setIsPinching(true);
      startPos.current.dist = getDistance(e.touches);
      startPos.current.scale = scale;
    } else if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true);
      startPos.current.x = e.touches[0].clientX;
      startPos.current.y = e.touches[0].clientY;
      startPos.current.posX = x;
      startPos.current.posY = y;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isPinching && e.touches.length === 2) {
      isMoved.current = true;
      const dist = getDistance(e.touches);
      let newScale = startPos.current.scale * (dist / startPos.current.dist);
      
      // 添加在触摸状态下的极强阻力
      if (newScale < 1) {
        // 如果想猛缩，也只微微缩小
        newScale = 1 - (1 - newScale) * 0.15;
        // 刚性底线，防止回弹感觉太长
        newScale = Math.max(newScale, 0.85);
      } else {
        newScale = Math.min(newScale, 8);
      }

      setTransform(prev => ({
        ...prev,
        scale: newScale
      }));
    } else if (isDragging && e.touches.length === 1) {
      isMoved.current = true;
      const dx = e.touches[0].clientX - startPos.current.x;
      const dy = e.touches[0].clientY - startPos.current.y;
      setTransform(prev => ({
        ...prev,
        x: startPos.current.posX + dx,
        y: startPos.current.posY + dy
      }));
    }
  };

  const handleTouchEnd = () => {
    setTimeout(() => {
      isMoved.current = false;
    }, 50);
    setIsPinching(false);
    setIsDragging(false);
    if (scale < 1) {
      setTransform({ scale: 1, x: 0, y: 0 });
    }
  };

  // --- Mouse (Pan) ---
  const handleMouseDown = (e: React.MouseEvent) => {
    isMoved.current = false;
    if (scale > 1 && e.button === 0) { // Only left click for dragging
      setIsDragging(true);
      startPos.current.x = e.clientX;
      startPos.current.y = e.clientY;
      startPos.current.posX = x;
      startPos.current.posY = y;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      isMoved.current = true;
      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;
      setTransform(prev => ({
        ...prev,
        x: startPos.current.posX + dx,
        y: startPos.current.posY + dy
      }));
    }
  };

  const handleMouseUp = () => {
    // delay reset slightly to let onClick fire and see isMoved
    setTimeout(() => {
      isMoved.current = false;
    }, 50);
    setIsDragging(false);
  };

  const handleDoubleClick = () => {
    if (scale > 1) {
      setTransform({ scale: 1, x: 0, y: 0 });
    } else {
      setTransform({ scale: 2.5, x: 0, y: 0 });
    }
  };

  if (!previewImage) return null;

  const handleClose = () => {
    setIsClosing(true);
    // Wait for the exit animation to finish
    setTimeout(() => {
      setPreviewImage(null);
      setIsClosing(false);
    }, 250); 
  };

  const handleOverlayClick = () => {
    // If user was dragging, don't close
    if (isMoved.current) {
      return;
    }
    handleClose();
  };

  const handleDownload = async () => {
    if (isDownloading) return;
    
    try {
      setIsDownloading(true);
      // Fetch the blob directly to bypass browser's default exact view behavior
      const response = await fetch(`/api/original/${encodeURIComponent(previewImage.id)}?download=1`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const filename = response.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || `${previewImage.id}.jpg`;
      
      // Create temporary link and click it
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
      // Fallback
      window.open(`/api/original/${encodeURIComponent(previewImage.id)}?download=1`, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  // Prevent clicks inside the container from closing the viewer
  const handleContainerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // The actual high quality image URL
  const imageUrl = `/api/original/${encodeURIComponent(previewImage.id)}`;

  const isAnimating = (!isDragging && !isPinching);
  const wrapperStyle: React.CSSProperties = {
    transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`,
    transition: isAnimating ? 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
    cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'auto',
    willChange: 'transform'
  };

  return (
    <div 
      className={`${styles.overlay} ${isClosing ? styles.closing : ''}`}
      onClick={handleOverlayClick}
      ref={overlayRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      <div className={styles.controls} onClick={(e) => { e.stopPropagation(); setIsDragging(false); }}>
        <button 
          className={`${styles.controlBtn} ${isDownloading ? styles.downloading : ''}`} 
          onClick={handleDownload}
          title={t('download')}
          disabled={isDownloading}
        >
          <DownloadIcon width={20} height={20} />
        </button>
        <button 
          className={styles.controlBtn} 
          onClick={handleClose}
          title={t('cancel') || 'Close'}
        >
          <CloseIcon />
        </button>
      </div>

      <div 
        className={styles.container} 
        onClick={handleContainerClick}
        style={wrapperStyle}
      >
        <div className={styles.imageWrapper}>
          {!isLoaded && <div className={styles.loadingSpinner} />}
          <img 
            src={imageUrl} 
            alt={previewImage.name} 
            className={`${styles.image} ${isLoaded ? styles.loaded : ''}`}
            onLoad={() => setIsLoaded(true)}
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}