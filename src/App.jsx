import { useState, useRef, useEffect } from 'react';
import { Camera, X, UploadCloud, Image as ImageIcon, Loader2, ChevronLeft, ChevronRight, Lock, Unlock, Trash2, Download } from 'lucide-react';
import { db } from './firebase';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, deleteDoc } from 'firebase/firestore';
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

function App() {
  const [photos, setPhotos] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(null);
  
  // Admin States
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

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

  const handleUploadClick = () => {
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (!isUploading) {
      setIsModalOpen(false);
    }
  };

  const onFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleNewPhoto(e.target.files[0]);
    }
  };

  const handleNewPhoto = async (file) => {
    if (!file) return;
    setIsUploading(true);

    try {
      // Compress the image and get the base64 URL
      const compressedUrl = await compressImage(file);
      
      // Save directly to Firestore Database
      await addDoc(collection(db, "photos"), {
        url: compressedUrl,
        timestamp: serverTimestamp()
      });

      setIsUploading(false);
      closeModal();
    } catch (error) {
      console.error("Error during image upload/compression:", error);
      alert("Fotoğraf işlenirken ve yüklenirken bir hata oluştu.");
      setIsUploading(false);
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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleNewPhoto(e.dataTransfer.files[0]);
    }
  };

  // Gallery Navigation Functions
  const handlePrevPhoto = (e) => {
    if (e) e.stopPropagation();
    if (selectedPhotoIndex !== null && photos.length > 0) {
      const nextIndex = selectedPhotoIndex === 0 ? photos.length - 1 : selectedPhotoIndex - 1;
      setSelectedPhotoIndex(nextIndex);
    }
  };

  const handleNextPhoto = (e) => {
    if (e) e.stopPropagation();
    if (selectedPhotoIndex !== null && photos.length > 0) {
      const nextIndex = selectedPhotoIndex === photos.length - 1 ? 0 : selectedPhotoIndex + 1;
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
  }, [selectedPhotoIndex, photos]);

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

  return (
    <div className="app-wrapper">
      {/* Header Section */}
      <header className="header text-center animate-fade-in">
        <div className="hero-image-container">
          <img src="/kapak.jpeg?v=5" alt="Burcu ve Osman Emre" className="hero-image" />
        </div>
        <h1>Burcu & Osman Emre</h1>
        <p>Nişan törenimize hoş geldiniz! En güzel anılarımızı yakalayın ve bizimle paylaşın.</p>
      </header>

      {/* Admin Panel Controls */}
      {isAdmin && (
        <div className="admin-bar animate-fade-in container" style={{ marginBottom: '2rem' }}>
          <div className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(26, 26, 26, 0.05)', borderColor: 'rgba(26, 26, 26, 0.1)' }}>
            <div>
              <strong style={{ color: 'var(--accent-color)' }}>Yönetici Modu Açık</strong>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>Toplam {photos.length} fotoğraf yüklendi.</p>
            </div>
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
      )}

      {/* Masonry Gallery */}
      <main className="container">
        {photos.length === 0 ? (
          <div className="text-center animate-fade-in delay-200" style={{ padding: '3rem 1rem', color: 'var(--text-light)' }}>
            <ImageIcon size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
            <p>Henüz fotoğraf yüklenmedi.</p>
            <p>İlk fotoğrafı siz yükleyin!</p>
          </div>
        ) : (
          <div className="gallery animate-fade-in delay-200">
            {photos.map((photo, index) => (
              <div 
                key={photo.id} 
                className="photo-card glass-panel"
                style={{ position: 'relative' }}
              >
                <img 
                  src={photo.url} 
                  alt="Nişan Hatırası" 
                  loading="lazy"
                  onClick={() => setSelectedPhotoIndex(index)}
                  style={{ cursor: 'pointer' }}
                  onContextMenu={!isAdmin ? (e) => e.preventDefault() : undefined}
                  onDragStart={!isAdmin ? (e) => e.preventDefault() : undefined}
                />
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
          <span>Fotoğraf Yükle</span>
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
                <h3>Yükleniyor...</h3>
                <p style={{ color: 'var(--text-light)' }}>Lütfen bekleyin, anınız kaydediliyor.</p>
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
                  
                  {/* Accept images and allow camera capture on mobile */}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden-input" 
                    accept="image/*" 
                    onChange={onFileSelect}
                  />
                </div>

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
            <img 
              src={photos[selectedPhotoIndex].url} 
              alt="Büyük Görsel" 
              className="lightbox-image" 
              onContextMenu={!isAdmin ? (e) => e.preventDefault() : undefined}
              onDragStart={!isAdmin ? (e) => e.preventDefault() : undefined}
            />
            {isAdmin && (
              <a 
                href={photos[selectedPhotoIndex].url} 
                download="nisan-hatirasi.jpg" 
                className="download-button"
                onClick={e => e.stopPropagation()}
              >
                Fotoğrafı İndir
              </a>
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
    </div>
  );
}

export default App;
