import { useState, useRef, useEffect } from 'react';
import { Camera, X, UploadCloud, Image as ImageIcon, Loader2, ChevronLeft, ChevronRight, Lock, Unlock, Trash2, Download, MapPin } from 'lucide-react';
import { db } from './firebase';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import JSZip from 'jszip';
import './App.css';

// Helper function to compress and convert image to Base64
const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1920; // Full HD quality, highly detailed on all devices
        const MAX_HEIGHT = 1920;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Convert image to JPEG with 0.85 quality (visually indistinguishable from original, still under 350KB)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(dataUrl);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

// Custom SVG Icons for the wedding invitation layout
const CalendarHeartIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <path d="M12 13.5c-.8-1-2.5-1-2.5.8 0 1.2 1.3 2.2 2.5 3.2 1.2-1 2.5-2 2.5-3.2 0-1.8-1.7-1.8-2.5-.8z" fill="currentColor" />
  </svg>
);

const InterlockingRingsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="13" r="4.5" />
    <circle cx="15" cy="13" r="4.5" />
    <path d="M9 8.5 L9.5 7 L9 5.5 L8.5 7 Z" fill="currentColor" stroke="none" />
    <path d="M15 8.5 L15.5 7 L15 5.5 L14.5 7 Z" fill="currentColor" stroke="none" />
  </svg>
);

const CameraHeartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <path d="M12 14c-.6-1-1.8-1-1.8.6 0 .9.9 1.6 1.8 2.4 1-.8 1.8-1.5 1.8-2.4 0-1.6-1.2-1.6-1.8-.6z" fill="currentColor" />
  </svg>
);

const HeartDivider = () => (
  <div className="heart-divider">
    <span>♡</span>
  </div>
);

function App() {
  const [photos, setPhotos] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(null);
  
  // Admin States
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  // Card View State (Simple routing via query param ?kart)
  const [isCardView, setIsCardView] = useState(window.location.search.includes('kart'));

  // Screenshot/Blur State
  const [isWindowBlurred, setIsWindowBlurred] = useState(false);

  // Active list for Lightbox (either approvedPhotos or pendingPhotos)
  const [lightboxList, setLightboxList] = useState([]);

  const fileInputRef = useRef(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  useEffect(() => {
    // Listen to real-time updates from Firestore
    const q = query(collection(db, "photos"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedPhotos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPhotos(loadedPhotos);
    });

    return () => unsubscribe();
  }, []);

  // Screen protection listeners
  useEffect(() => {
    if (isAdmin) {
      setIsWindowBlurred(false);
      return;
    }

    const handleVisibilityChange = () => {
      setIsWindowBlurred(document.hidden);
    };

    const handleKeyDown = (e) => {
      // Print Screen
      if (e.key === 'PrintScreen') {
        try {
          navigator.clipboard.writeText('');
        } catch (err) {}
        alert('Ekran görüntüsü alma engellendir.');
        e.preventDefault();
      }
      // Print page
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        alert('Sayfayı yazdırma işlemi engellenmiştir.');
        e.preventDefault();
      }
      // Save page
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        alert('Sayfayı kaydetme işlemi engellenmiştir.');
        e.preventDefault();
      }
      // Copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
      }
      // View Source
      if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
      }
      // Inspect Element
      if (e.key === 'F12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'C' || e.key === 'c' || e.key === 'J' || e.key === 'j'))) {
        e.preventDefault();
      }
    };

    const handleContextMenu = (e) => {
      e.preventDefault();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [isAdmin]);

  // Listen to popstate to toggle card view dynamically
  useEffect(() => {
    const handlePopState = () => {
      setIsCardView(window.location.search.includes('kart'));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Filter approved and pending photos
  const approvedPhotos = photos.filter(photo => photo.approved !== false && photo.approved !== 'false');
  const pendingPhotos = photos.filter(photo => photo.approved === false || photo.approved === 'false');

  const handleUploadClick = () => {
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (!isUploading) {
      setIsModalOpen(false);
    }
  };

  const onFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleNewPhotos(Array.from(e.target.files));
    }
  };

  const handleNewPhotos = async (files) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setUploadProgress({ current: 0, total: files.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        // Compress the image and get the base64 URL
        const compressedUrl = await compressImage(file);
        
        // Save directly to Firestore Database with approval pending
        await addDoc(collection(db, "photos"), {
          url: compressedUrl,
          timestamp: serverTimestamp(),
          approved: false // Needs admin approval
        });
        successCount++;
      } catch (error) {
        console.error("Error during image upload/compression:", error);
        failCount++;
      }
      setUploadProgress(prev => ({ ...prev, current: i + 1 }));
    }

    setIsUploading(false);
    closeModal();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (failCount === 0) {
      if (successCount === 1) {
        alert("Fotoğrafınız başarıyla yüklendi! Yönetici onayından sonra galeride görünecektir.");
      } else {
        alert(`${successCount} adet fotoğraf başarıyla yüklendi! Yönetici onayından sonra galeride görünecektir.`);
      }
    } else if (successCount > 0) {
      alert(`${successCount} adet fotoğraf başarıyla yüklendi, ${failCount} adet fotoğraf yüklenirken hata oluştu. Yönetici onayından sonra galeride görünecektir.`);
    } else {
      alert("Fotoğraflar yüklenirken bir hata oluştu.");
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleNewPhotos(Array.from(e.dataTransfer.files));
    }
  };

  // Gallery Navigation Functions
  const handlePrevPhoto = (e) => {
    if (e) e.stopPropagation();
    if (selectedPhotoIndex !== null && lightboxList.length > 0) {
      const nextIndex = selectedPhotoIndex === 0 ? lightboxList.length - 1 : selectedPhotoIndex - 1;
      setSelectedPhotoIndex(nextIndex);
    }
  };

  const handleNextPhoto = (e) => {
    if (e) e.stopPropagation();
    if (selectedPhotoIndex !== null && lightboxList.length > 0) {
      const nextIndex = selectedPhotoIndex === lightboxList.length - 1 ? 0 : selectedPhotoIndex + 1;
      setSelectedPhotoIndex(nextIndex);
    }
  };

  // Keyboard navigation listener (Left, Right, Escape)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (selectedPhotoIndex === null) return;
      if (e.key === 'ArrowLeft') {
        handlePrevPhoto();
      } else if (e.key === 'ArrowRight') {
        handleNextPhoto();
      } else if (e.key === 'Escape') {
        setSelectedPhotoIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPhotoIndex, lightboxList]);

  // Touch Swipe Handlers for Mobile Devices
  const handleTouchStart = (e) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchEndX.current = e.targetTouches[0].clientX; // Initialize to prevent unintentional swipe triggers
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    const swipeThreshold = 50;
    const diffX = touchStartX.current - touchEndX.current;

    if (Math.abs(diffX) > swipeThreshold) {
      if (diffX > 0) {
        // Swiped Left -> Show Next Photo
        handleNextPhoto();
      } else {
        // Swiped Right -> Show Prev Photo
        handlePrevPhoto();
      }
    }
  };

  // Admin Functions
  const handleAdminLogin = (e) => {
    e.preventDefault();
    // Default admin password: nisan2026
    if (adminPasswordInput === 'nisan2026') {
      setIsAdmin(true);
      setIsAdminModalOpen(false);
      setAdminPasswordInput('');
    } else {
      alert('Hatalı şifre!');
    }
  };

  const handleDelete = async (photoId) => {
    if (window.confirm("Bu fotoğrafı galeriden silmek istediğinize emin misiniz?")) {
      try {
        await deleteDoc(doc(db, "photos", photoId));
      } catch (error) {
        console.error("Error deleting photo:", error);
        alert("Fotoğraf silinirken bir hata oluştu.");
      }
    }
  };

  const handleApprove = async (photoId) => {
    try {
      await updateDoc(doc(db, "photos", photoId), {
        approved: true
      });
    } catch (error) {
      console.error("Error approving photo:", error);
      alert("Fotoğraf onaylanırken bir hata oluştu.");
    }
  };

  const handleApproveFromLightbox = async (photoId) => {
    await handleApprove(photoId);
    setSelectedPhotoIndex(null);
  };

  const handleDeleteFromLightbox = async (photoId) => {
    if (window.confirm("Bu fotoğrafı reddetmek ve silmek istediğinize emin misiniz?")) {
      try {
        await deleteDoc(doc(db, "photos", photoId));
        setSelectedPhotoIndex(null);
      } catch (error) {
        console.error("Error deleting photo from lightbox:", error);
        alert("Fotoğraf silinirken bir hata oluştu.");
      }
    }
  };

  const handleDownloadAll = async () => {
    if (photos.length === 0) {
      alert("İndirilecek fotoğraf bulunamadı.");
      return;
    }
    setIsZipping(true);
    try {
      const zip = new JSZip();
      
      // Process each base64 image
      photos.forEach((photo, index) => {
        const base64Data = photo.url;
        // Extract the raw base64 content (after the comma: data:image/jpeg;base64,xxxx)
        const base64Content = base64Data.split(',')[1];
        if (base64Content) {
          // Name the files sequentially
          const filename = `nisan-hatirasi-${index + 1}.jpg`;
          zip.file(filename, base64Content, { base64: true });
        }
      });

      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = 'nisan-hatiralari.zip';
      link.click();
    } catch (error) {
      console.error('Error creating zip:', error);
      alert('Fotoğraflar sıkıştırılırken bir hata oluştu.');
    } finally {
      setIsZipping(false);
    }
  };

  // RENDER CARD PRINT VIEW
  if (isCardView) {
    return (
      <div className="card-print-container animate-fade-in">
        <div className="no-print print-header">
          <button 
            onClick={() => {
              window.history.pushState({}, '', '/');
              setIsCardView(false);
            }} 
            className="upload-button" 
            style={{ fontSize: '0.9rem', padding: '0.5rem 1.25rem', background: '#333' }}
          >
            ← Galeriye Dön
          </button>
          <button 
            onClick={() => window.print()} 
            className="upload-button" 
            style={{ fontSize: '0.9rem', padding: '0.5rem 1.25rem', background: 'var(--accent-color)' }}
          >
            Yazdır (Print)
          </button>
        </div>

        <div className="printable-card-frame">
          <div className="card-decor-top">✿ ✿ ✿</div>
          <h2 className="card-names">
            <span className="name-line">Burcu</span>
            <span className="and-symbol">and</span>
            <span className="name-line">Osman Emre</span>
          </h2>
          <h3 className="card-title">Nişan Hatırası</h3>
          
          <div className="card-qr-container">
            <img src="/qr-kod.png" alt="QR Kod" className="card-qr-img" />
          </div>

          <div className="card-instruction">
            <p className="highlight">Fotoğraflarınızla Anımızı Paylaşın!</p>
            <p>Kameranızla QR kodu okutarak bugün çektiğiniz tüm fotoğrafları doğrudan galerimize yükleyebilirsiniz.</p>
          </div>

          <div className="card-decor-bottom">✿ ✿ ✿</div>
          <div className="card-footer">burcu-osmanemre.vercel.app</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      {/* Header Section */}
      <header className="header text-center animate-fade-in">
        <div className="arch-frame-outer">
          <div className="arch-frame-inner">
            <div className="hero-image-container">
              <img src="/kapak.jpeg?v=5" alt="Burcu ve Osman Emre" className="hero-image" />
            </div>
          </div>
        </div>

        <HeartDivider />

        <div className="invite-date">11 Temmuz 2026</div>
        <h1>
          <span className="name-line">Burcu</span>
          <span className="and-symbol">and</span>
          <span className="name-line">Osman Emre</span>
        </h1>
        <p>Nişan törenimize hoş geldiniz!<br />En güzel anılarımızı yakalayın ve bizimle paylaşın.</p>

        <div className="details-container">
          <div className="details-column">
            <div className="details-icon">
              <CalendarHeartIcon />
            </div>
            <div className="details-title">11 Temmuz 2026</div>
            <div className="details-subtitle">Cumartesi</div>
          </div>
          <div className="details-column">
            <div className="details-icon">
              <MapPin size={22} strokeWidth={1.5} />
            </div>
            <div className="details-title">BİRGÜL DAVET EVİ</div>
            <div className="details-subtitle">Darıca</div>
          </div>
          <div className="details-column">
            <div className="details-icon">
              <InterlockingRingsIcon />
            </div>
            <div className="details-title">BİRLİKTE</div>
            <div className="details-subtitle">Sonsuza</div>
          </div>
        </div>

        <HeartDivider />
      </header>

      {/* Admin Panel Controls */}
      {isAdmin && (
        <div className="admin-bar animate-fade-in container" style={{ marginBottom: '2rem' }}>
          <div className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(26, 26, 26, 0.05)', borderColor: 'rgba(26, 26, 26, 0.1)', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <strong style={{ color: 'var(--accent-color)' }}>Yönetici Modu Açık</strong>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>Toplam {photos.length} fotoğraf yüklendi.</p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                className="upload-button" 
                style={{ fontSize: '0.9rem', padding: '0.5rem 1.25rem', boxShadow: 'none', background: 'transparent', border: '1px solid var(--accent-color)', color: 'var(--accent-color)' }}
                onClick={() => {
                  window.history.pushState({}, '', '?kart');
                  setIsCardView(true);
                }}
              >
                Masa Kartı Tasarımı
              </button>
              <button 
                className="upload-button" 
                style={{ fontSize: '0.9rem', padding: '0.5rem 1.25rem', boxShadow: 'none' }}
                onClick={handleDownloadAll}
                disabled={isZipping}
              >
                {isZipping ? (
                  <>
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>ZIP Hazırlanıyor...</span>
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    <span>Tümünü İndir (.ZIP)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Panel Approval Queue */}
      {isAdmin && pendingPhotos.length > 0 && (
        <section className="container pending-section animate-fade-in" style={{ marginBottom: '3rem', marginTop: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', color: 'var(--accent-color)', marginBottom: '1.25rem', borderBottom: '1px solid rgba(74,93,78,0.12)', paddingBottom: '0.5rem' }}>
            Onay Bekleyen Fotoğraflar ({pendingPhotos.length})
          </h2>
          <div className="pending-grid">
            {pendingPhotos.map((photo, index) => (
              <div key={photo.id} className="pending-card glass-panel">
                <div className="pending-img-container" onClick={() => {
                  setSelectedPhotoIndex(index);
                  setLightboxList(pendingPhotos);
                }}>
                  <img src={photo.url} alt="Onay bekliyor" />
                </div>
                <div className="pending-actions">
                  <button className="approve-btn" onClick={() => handleApprove(photo.id)}>
                    Onayla
                  </button>
                  <button className="reject-btn" onClick={() => handleDelete(photo.id)}>
                    Sil
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Masonry Gallery with Protection Overlays */}
      <main className="container">
        {approvedPhotos.length === 0 ? (
          <div className="text-center animate-fade-in delay-200" style={{ padding: '3rem 1rem', color: 'var(--text-light)' }}>
            <ImageIcon size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
            <p>Henüz fotoğraf yüklenmedi.</p>
            <p>İlk fotoğrafı siz yükleyin!</p>
          </div>
        ) : (
          <div className="gallery animate-fade-in delay-200">
            {approvedPhotos.map((photo, index) => (
              <div 
                key={photo.id} 
                className="photo-card glass-panel"
                style={{ position: 'relative' }}
                onClick={() => {
                  setSelectedPhotoIndex(index);
                  setLightboxList(approvedPhotos);
                }}
              >
                <div style={{ position: 'relative', width: '100%', display: 'block' }}>
                  <img 
                    src={photo.url} 
                    alt="Nişan Hatırası" 
                    loading="lazy"
                    onContextMenu={!isAdmin ? (e) => e.preventDefault() : undefined}
                    onDragStart={!isAdmin ? (e) => e.preventDefault() : undefined}
                  />
                  {!isAdmin && <div className="photo-overlay-protection" />}
                </div>
                {isAdmin && (
                  <button 
                    className="delete-photo-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(photo.id);
                    }}
                    title="Fotoğrafı Sil"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Action Button */}
      <div className="fab-container animate-fade-in delay-300">
        <button className="upload-button" onClick={handleUploadClick}>
          <Camera size={24} />
          <span>Anılarınızı Bizimle Paylaşın</span>
        </button>
      </div>

      {/* Upload Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-button" onClick={closeModal} disabled={isUploading}>
              <X size={24} />
            </button>
            
            {isUploading ? (
              <div className="text-center" style={{ padding: '2rem 0' }}>
                <Loader2 size={48} className="upload-icon" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
                <h3>Fotoğraflar Yükleniyor...</h3>
                {uploadProgress.total > 1 && (
                  <p style={{ color: 'var(--accent-color)', fontWeight: '600', fontSize: '1.2rem', margin: '0.5rem 0' }}>
                    {uploadProgress.current} / {uploadProgress.total}
                  </p>
                )}
                <p style={{ color: 'var(--text-light)' }}>Lütfen bekleyin, anılarınız kaydediliyor.</p>
              </div>
            ) : (
              <>
                <h2 className="text-center" style={{ marginBottom: '0.5rem' }}>Anıyı Paylaş</h2>
                <p className="text-center text-light" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                  Galeriden seçin veya yeni bir fotoğraf çekin
                </p>

                <div 
                  className={`upload-area ${isDragging ? 'dragging' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud size={48} className="upload-icon" />
                  <h3 style={{ marginBottom: '0.5rem' }}>Fotoğraf Yükle</h3>
                  <p style={{ color: 'var(--text-light)', fontSize: '0.875rem' }}>
                    Dokunarak seçin veya sürükleyip bırakın
                  </p>
                </div>

                {/* Accept images and allow camera capture on mobile */}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden-input" 
                  accept="image/*" 
                  multiple
                  onChange={onFileSelect}
                  onClick={(e) => e.stopPropagation()}
                />

                <button 
                  className="upload-button" 
                  style={{ width: '100%', marginTop: '1.5rem', justifyContent: 'center' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon size={20} />
                  Galeri / Kamera
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Lightbox Modal for Fullscreen Photo View with Navigation */}
      {selectedPhotoIndex !== null && photos[selectedPhotoIndex] && (
        <div 
          className="lightbox-overlay" 
          onClick={() => setSelectedPhotoIndex(null)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Close Button */}
          <button className="lightbox-close" onClick={() => setSelectedPhotoIndex(null)}>
            <X size={28} />
          </button>

          {/* Left Arrow Button for Desktop */}
          <button className="lightbox-nav-button prev-button" onClick={handlePrevPhoto}>
            <ChevronLeft size={36} />
          </button>

          {/* Image & Download Button */}
          <div className="lightbox-content" onClick={e => e.stopPropagation()}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img 
                src={lightboxList[selectedPhotoIndex].url} 
                alt="Büyük Görsel" 
                className="lightbox-image" 
                onContextMenu={!isAdmin ? (e) => e.preventDefault() : undefined}
                onDragStart={!isAdmin ? (e) => e.preventDefault() : undefined}
              />
              {!isAdmin && <div className="photo-overlay-protection" />}
            </div>
            {isAdmin && (
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                {lightboxList[selectedPhotoIndex].approved === false ? (
                  <>
                    <button 
                      className="download-button"
                      style={{ background: 'rgba(220, 38, 38, 0.95)', color: '#ffffff' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFromLightbox(lightboxList[selectedPhotoIndex].id);
                      }}
                    >
                      Reddet
                    </button>
                    <button 
                      className="download-button"
                      style={{ background: 'var(--accent-color)', color: '#ffffff' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApproveFromLightbox(lightboxList[selectedPhotoIndex].id);
                      }}
                    >
                      Fotoğrafı Onayla
                    </button>
                  </>
                ) : (
                  <a 
                    href={lightboxList[selectedPhotoIndex].url} 
                    download="nisan-hatirasi.jpg" 
                    className="download-button"
                    onClick={e => e.stopPropagation()}
                  >
                    Fotoğrafı İndir
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Right Arrow Button for Desktop */}
          <button className="lightbox-nav-button next-button" onClick={handleNextPhoto}>
            <ChevronRight size={36} />
          </button>
        </div>
      )}

      {/* Admin Login Modal */}
      {isAdminModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAdminModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-button" onClick={() => setIsAdminModalOpen(false)}>
              <X size={24} />
            </button>
            <h2 className="text-center" style={{ marginBottom: '1.5rem' }}>Yönetici Girişi</h2>
            <form onSubmit={handleAdminLogin}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-light)' }}>
                  Yönetici Şifresi:
                </label>
                <input 
                  type="password" 
                  value={adminPasswordInput}
                  onChange={e => setAdminPasswordInput(e.target.value)}
                  placeholder="Şifreyi girin"
                  style={{ 
                    width: '100%', 
                    padding: '0.75rem 1rem', 
                    borderRadius: '0.75rem', 
                    border: '1px solid #e5e5e5',
                    fontSize: '1rem',
                    fontFamily: 'inherit'
                  }}
                  autoFocus
                />
              </div>
              <button 
                type="submit"
                className="upload-button" 
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Giriş Yap
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Footer / Admin Access */}
      <footer style={{ marginTop: '4rem', padding: '2rem 1rem 3rem', textAlign: 'center', opacity: 0.6, fontSize: '0.85rem' }}>
        <p>© 2026 Burcu & Osman Emre. Tüm Hakları Saklıdır.</p>
        <button 
          onClick={() => {
            if (isAdmin) {
              setIsAdmin(false);
            } else {
              setIsAdminModalOpen(true);
            }
          }}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: 'var(--text-light)', 
            cursor: 'pointer', 
            marginTop: '1rem', 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '0.5rem' 
          }}
        >
          {isAdmin ? (
            <>
              <Unlock size={14} />
              <span>Yönetici Modunu Kapat</span>
            </>
          ) : (
            <>
              <Lock size={14} />
              <span>Yönetici Girişi</span>
            </>
          )}
        </button>
      </footer>

      {/* Screen blur protection overlay */}
      {isWindowBlurred && !isAdmin && (
        <div className="screenshot-protection-overlay">
          <div className="protection-content">
            <Lock size={48} style={{ marginBottom: '1rem', color: 'var(--accent-color)' }} />
            <h3>Ekran Görünümü Korumalı</h3>
            <p>Güvenlik nedeniyle bu alanda ekran görüntüsü alınamaz.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
