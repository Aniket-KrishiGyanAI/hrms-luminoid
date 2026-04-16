import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Modal, Form, Badge, ProgressBar, InputGroup, Tabs, Tab } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { toast } from 'react-toastify';
import './TrainingMaterials.css';

const TrainingMaterials = () => {
  const { user } = useAuth();
  const isAdmin = ['HR', 'ADMIN'].includes(user?.role);
  const canManageCertificates = ['HR', 'ADMIN', 'MANAGER'].includes(user?.role);

  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressData, setProgressData] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', category: '', externalUrl: '', thumbnail: null, targetRoles: [], targetDepartments: [], isMandatory: false, dueDate: '', estimatedMinutes: '', files: [] });
  const [departments, setDepartments] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [visibleCourses, setVisibleCourses] = useState(12); // Lazy loading
  const [imageCache, setImageCache] = useState({}); // Image caching
  const [myStats, setMyStats] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState('month');
  const [uploadingCertificate, setUploadingCertificate] = useState(null);

  useEffect(() => { fetchMaterials(); }, []);
  useEffect(() => { if (isAdmin) fetchDepartments(); }, [isAdmin]);
  useEffect(() => { if (!isAdmin) fetchMyStats(); }, [isAdmin]);

  // Fetch progress data when detail modal opens for admin/manager
  useEffect(() => {
    if (showDetailModal && selectedMaterial && canManageCertificates) {
      api.get(`/api/training/${selectedMaterial._id}/progress`)
        .then(res => setProgressData(res.data))
        .catch(() => {});
    }
    // Also fetch for employees to check certificate status
    if (showDetailModal && selectedMaterial && !canManageCertificates) {
      api.get(`/api/training/${selectedMaterial._id}/progress`)
        .then(res => {
          // Find current user's progress
          const myProgress = res.data.find(p => p.userId._id === user._id);
          if (myProgress) {
            setProgressData([myProgress]);
          }
        })
        .catch(() => {});
    }
  }, [showDetailModal, selectedMaterial, canManageCertificates, user]);

  const fetchMyStats = async () => {
    try {
      const res = await api.get('/api/training/my-stats');
      setMyStats(res.data);
    } catch (err) {}
  };

  const fetchLeaderboard = async (period = 'month') => {
    try {
      const res = await api.get(`/api/training/leaderboard?period=${period}`);
      setLeaderboardData(res.data);
      setShowLeaderboard(true);
    } catch (err) {
      toast.error('Failed to load leaderboard');
    }
  };

  const fetchMaterials = async () => {
    try {
      // Check cache first
      const cacheKey = 'training_materials';
      const cachedData = sessionStorage.getItem(cacheKey);
      const cacheTime = sessionStorage.getItem(`${cacheKey}_time`);
      
      // Use cache if less than 5 minutes old
      if (cachedData && cacheTime && (Date.now() - parseInt(cacheTime)) < 300000) {
        setMaterials(JSON.parse(cachedData));
        setLoading(false);
        return;
      }

      const res = await api.get('/api/training');
      setMaterials(res.data);
      
      // Cache the data
      sessionStorage.setItem(cacheKey, JSON.stringify(res.data));
      sessionStorage.setItem(`${cacheKey}_time`, Date.now().toString());
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load materials');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/api/training/departments');
      setDepartments(res.data);
    } catch (err) {}
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!form.title) return toast.error('Title is required');
    if (!form.externalUrl && form.files.length === 0 && !editMode) return toast.error('Please upload at least one file or provide an external URL');

    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('description', form.description);
      fd.append('category', form.category);
      fd.append('externalUrl', form.externalUrl);
      fd.append('targetRoles', JSON.stringify(form.targetRoles));
      fd.append('targetDepartments', JSON.stringify(form.targetDepartments));
      fd.append('isMandatory', form.isMandatory);
      fd.append('dueDate', form.dueDate);
      fd.append('estimatedMinutes', form.estimatedMinutes || 0);
      
      if (form.thumbnail) fd.append('thumbnail', form.thumbnail);
      
      // Append all files
      form.files.forEach((file) => {
        fd.append('files', file);
      });

      if (editMode) {
        await api.put(`/api/training/${selectedMaterial._id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Updated successfully');
      } else {
        await api.post('/api/training', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Uploaded successfully');
      }

      setShowUploadModal(false);
      resetForm();
      
      // Clear cache after upload/update
      sessionStorage.removeItem('training_materials');
      sessionStorage.removeItem('training_materials_time');
      
      fetchMaterials();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed');
    }
  };

  const resetForm = () => {
    setForm({ title: '', description: '', category: '', externalUrl: '', thumbnail: null, targetRoles: [], targetDepartments: [], isMandatory: false, dueDate: '', estimatedMinutes: '', files: [] });
    setEditMode(false);
    setSelectedMaterial(null);
  };

  const handleEdit = (material) => {
    setSelectedMaterial(material);
    setForm({
      title: material.title,
      description: material.description || '',
      category: material.category || '',
      externalUrl: material.externalUrl || '',
      thumbnail: null,
      targetRoles: material.targetRoles || [],
      targetDepartments: material.targetDepartments || [],
      isMandatory: material.isMandatory || false,
      dueDate: material.dueDate ? new Date(material.dueDate).toISOString().split('T')[0] : '',
      estimatedMinutes: material.estimatedMinutes || '',
      files: []
    });
    setEditMode(true);
    setShowUploadModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this material?')) return;
    try {
      await api.delete(`/api/training/${id}`);
      toast.success('Deleted');
      
      // Clear cache after delete
      sessionStorage.removeItem('training_materials');
      sessionStorage.removeItem('training_materials_time');
      
      fetchMaterials();
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  const handleProgressUpdate = async (materialId, status) => {
    try {
      await api.put(`/api/training/${materialId}/progress`, { status });
      toast.success('Progress updated');
      fetchMaterials();
    } catch (err) {
      toast.error('Failed to update progress');
    }
  };

  const handlePreview = async (material) => {
    if (material.externalUrl) {
      window.open(material.externalUrl, '_blank');
    } else if (material.s3Url) {
      try {
        const res = await api.get(`/api/training/${material._id}/download?preview=true`);
        window.open(res.data.downloadUrl, '_blank');
      } catch (err) {
        toast.error('Preview failed');
      }
    }
  };

  const handleDownloadCertificate = async (materialId) => {
    try {
      const res = await api.get(`/api/training/${materialId}/certificate`);
      
      // Check if response has downloadUrl (uploaded certificate)
      if (res.data.downloadUrl) {
        // Open the signed URL directly
        const link = document.createElement('a');
        link.href = res.data.downloadUrl;
        link.setAttribute('download', res.data.fileName || `certificate-${materialId}.pdf`);
        link.setAttribute('target', '_blank');
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success('Certificate downloaded');
      }
    } catch (err) {
      if (err.response?.status === 404) {
        toast.info('No certificate available for this course yet');
      } else {
        toast.error(err.response?.data?.message || 'Failed to download certificate');
      }
    }
  };

  const handleUploadCertificate = async (materialId, userId, file) => {
    try {
      setUploadingCertificate(`${materialId}-${userId}`);
      const fd = new FormData();
      fd.append('certificate', file);
      await api.post(`/api/training/${materialId}/progress/${userId}/certificate`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Certificate uploaded successfully');
      // Refresh progress data
      const res = await api.get(`/api/training/${materialId}/progress`);
      setProgressData(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload certificate');
    } finally {
      setUploadingCertificate(null);
    }
  };

  const handleDeleteCertificate = async (materialId, userId) => {
    if (!window.confirm('Delete this certificate?')) return;
    try {
      await api.delete(`/api/training/${materialId}/progress/${userId}/certificate`);
      toast.success('Certificate deleted');
      // Refresh progress data
      const res = await api.get(`/api/training/${materialId}/progress`);
      setProgressData(res.data);
    } catch (err) {
      toast.error('Failed to delete certificate');
    }
  };

  const openProgressModal = async (material) => {
    setSelectedMaterial(material);
    try {
      const res = await api.get(`/api/training/${material._id}/progress`);
      setProgressData(res.data);
      setShowProgressModal(true);
    } catch {
      toast.error('Failed to load progress');
    }
  };

  // Image optimization - lazy load images
  const OptimizedImage = ({ src, alt, className }) => {
    const [imageSrc, setImageSrc] = useState(null);
    const [imageLoading, setImageLoading] = useState(true);
    const imgRef = React.useRef();

    useEffect(() => {
      // Check cache
      if (imageCache[src]) {
        setImageSrc(imageCache[src]);
        setImageLoading(false);
        return;
      }

      // Intersection Observer for lazy loading
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const img = new Image();
              img.src = src;
              img.onload = () => {
                setImageSrc(src);
                setImageLoading(false);
                // Cache the image
                setImageCache(prev => ({ ...prev, [src]: src }));
              };
              observer.unobserve(entry.target);
            }
          });
        },
        { rootMargin: '50px' }
      );

      if (imgRef.current) {
        observer.observe(imgRef.current);
      }

      return () => {
        if (imgRef.current) {
          observer.unobserve(imgRef.current);
        }
      };
    }, [src]);

    return (
      <div ref={imgRef} className={className} style={{ position: 'relative' }}>
        {imageLoading && (
          <div className="skeleton" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}></div>
        )}
        {imageSrc && (
          <img 
            src={imageSrc} 
            alt={alt} 
            className={className}
            style={{ opacity: imageLoading ? 0 : 1, transition: 'opacity 0.3s ease' }}
          />
        )}
      </div>
    );
  };

  const categories = ['all', ...new Set(materials.map(m => m.category?.toLowerCase()).filter(Boolean))];
  const filteredMaterials = materials.filter(m => {
    const matchSearch = m.title.toLowerCase().includes(searchTerm.toLowerCase()) || m.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = selectedCategory === 'all' || m.category?.toLowerCase() === selectedCategory;
    return matchSearch && matchCategory;
  });

  const getStats = () => {
    const total = materials.length;
    const completed = materials.filter(m => m.progress?.status === 'COMPLETED').length;
    const inProgress = materials.filter(m => m.progress?.status === 'IN_PROGRESS').length;
    const notStarted = total - completed - inProgress;
    return { total, completed, inProgress, notStarted };
  };

  const stats = getStats();

  // Reset visible courses when filters change
  useEffect(() => {
    setVisibleCourses(12);
  }, [searchTerm, selectedCategory]);

  // Lazy loading - load more courses on scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.innerHeight + window.scrollY;
      const threshold = document.body.offsetHeight - 500;
      
      if (scrollPosition >= threshold && visibleCourses < filteredMaterials.length) {
        setVisibleCourses(prev => Math.min(prev + 12, filteredMaterials.length));
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [visibleCourses, filteredMaterials.length]);

  if (loading) return (
    <div className="training-container">
      {/* Hero Skeleton */}
      <div className="training-hero">
        <Container>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
            <div style={{ flex: 1 }}>
              <div className="skeleton skeleton-title" style={{ width: '60%', height: '40px', marginBottom: '1rem' }}></div>
              <div className="skeleton skeleton-text" style={{ width: '80%', height: '20px' }}></div>
            </div>
            <div className="skeleton skeleton-card" style={{ width: '200px', height: '150px', borderRadius: '20px' }}></div>
          </div>
          <div className="skeleton skeleton-search" style={{ width: '100%', height: '50px', borderRadius: '50px', marginTop: '1.5rem' }}></div>
        </Container>
      </div>

      <Container className="training-content">
        {/* Category Tabs Skeleton */}
        <div className="d-flex gap-2 mb-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton" style={{ width: '120px', height: '40px', borderRadius: '50px' }}></div>
          ))}
        </div>

        {/* Stats Cards Skeleton */}
        <Row className="mb-4">
          {[1, 2, 3, 4].map(i => (
            <Col xs={6} md={3} key={i}>
              <div className="skeleton skeleton-card" style={{ height: '120px', borderRadius: '12px' }}></div>
            </Col>
          ))}
        </Row>

        {/* Course Cards Skeleton */}
        <Row>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Col lg={4} md={6} key={i} className="mb-4">
              <div className="skeleton-course-card">
                <div className="skeleton" style={{ height: '180px', borderRadius: '16px 16px 0 0' }}></div>
                <div style={{ padding: '1rem' }}>
                  <div className="skeleton skeleton-text" style={{ width: '80%', height: '20px', marginBottom: '0.5rem' }}></div>
                  <div className="skeleton skeleton-text" style={{ width: '100%', height: '15px', marginBottom: '0.5rem' }}></div>
                  <div className="skeleton skeleton-text" style={{ width: '60%', height: '15px', marginBottom: '1rem' }}></div>
                  <div className="skeleton" style={{ width: '100%', height: '35px', borderRadius: '8px' }}></div>
                </div>
              </div>
            </Col>
          ))}
        </Row>
      </Container>
    </div>
  );

  return (
    <div className="training-container">
      {/* Hero Section */}
      <div className="training-hero">
        <Container>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
            <div>
              <h1 className="training-hero-title">Unlock Your Potential</h1>
              <p className="training-hero-subtitle">Explore a wide range of training materials designed to help you grow anytime, anywhere.</p>
            </div>
            
            <Card className="training-stats-card">
              <Card.Body>
                <div className="stat-item">
                  {isAdmin ? (
                    <>
                      <div className="stat-icon-animated">
                        <i className="fas fa-book-open"></i>
                        <div className="icon-ripple"></div>
                      </div>
                      <div className="stat-value">{stats.total}</div>
                      <div className="stat-label">Total Courses</div>
                    </>
                  ) : (
                    <>
                      <div className="stat-progress-circle">
                        <svg viewBox="0 0 36 36" className="circular-chart">
                          <path
                            className="circle-bg"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          <path
                            className="circle"
                            strokeDasharray={`${(stats.completed / stats.total) * 100}, 100`}
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          <text x="18" y="20.35" className="percentage">
                            {Math.round((stats.completed / stats.total) * 100)}%
                          </text>
                        </svg>
                      </div>
                      <div className="stat-value-animated">{stats.completed}/{stats.total}</div>
                      <div className="stat-label">Completed</div>
                      <div className="stat-motivational">
                        {stats.completed === 0 ? '🚀 Start your journey!' : 
                         stats.completed === stats.total ? '🎉 All done!' : 
                         `💪 ${stats.total - stats.completed} more to go!`}
                      </div>
                    </>
                  )}
                </div>
              </Card.Body>
            </Card>
          </div>
          
          {/* Search Bar */}
          <InputGroup className="training-search-bar mt-3">
            <InputGroup.Text><i className="fas fa-search"></i></InputGroup.Text>
            <Form.Control
              placeholder="Search for courses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>
        </Container>
      </div>

      <Container className="training-content">
        {/* Category Tabs */}
        <div className="training-tabs-wrapper">
          <div className="training-tabs">
            {categories.map(cat => (
              <button
                key={cat}
                className={`training-tab ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat === 'all' ? 'All Courses' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
          
          {isAdmin && (
            <Button className="btn-add-training" onClick={() => { resetForm(); setShowUploadModal(true); }}>
              <i className="fas fa-plus me-2"></i>Add Course
            </Button>
          )}
        </div>

        {/* Stats Cards for Employees */}
        {!isAdmin && myStats && (
          <>
            {/* Learning Streak & Achievements Banner */}
            {(myStats.streak > 0 || myStats.achievements.length > 0) && (
              <Card className="achievements-banner mb-4">
                <Card.Body>
                  <Row className="align-items-center">
                    {myStats.streak > 0 && (
                      <Col md={4}>
                        <div className="streak-display">
                          <div className="streak-icon">🔥</div>
                          <div>
                            <div className="streak-number">{myStats.streak} Days</div>
                            <div className="streak-label">Learning Streak!</div>
                          </div>
                        </div>
                      </Col>
                    )}
                    <Col md={myStats.streak > 0 ? 8 : 12}>
                      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                          <small className="text-muted fw-semibold">Achievements:</small>
                          {myStats.achievements.slice(0, 5).map(achievement => (
                            <div key={achievement.id} className="achievement-badge" title={achievement.description}>
                              <span className="achievement-icon">{achievement.icon}</span>
                              <span className="achievement-name">{achievement.name}</span>
                            </div>
                          ))}
                          {myStats.achievements.length > 5 && (
                            <Badge bg="secondary">+{myStats.achievements.length - 5} more</Badge>
                          )}
                        </div>
                        <Button size="sm" variant="outline-primary" onClick={() => fetchLeaderboard('month')}>
                          <i className="fas fa-trophy me-2"></i>View Leaderboard
                        </Button>
                      </div>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            )}

            <Row className="mb-4">
            <Col xs={6} md={3}>
              <Card className="stat-card-mini stat-card-total">
                <Card.Body>
                  <div className="stat-mini-icon">
                    <i className="fas fa-book-open"></i>
                  </div>
                  <div className="stat-mini-value">{stats.total}</div>
                  <div className="stat-mini-label">Total</div>
                </Card.Body>
              </Card>
            </Col>
            <Col xs={6} md={3}>
              <Card className="stat-card-mini stat-card-completed">
                <Card.Body>
                  <div className="stat-mini-icon">
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <div className="stat-mini-value">{stats.completed}</div>
                  <div className="stat-mini-label">Completed</div>
                </Card.Body>
              </Card>
            </Col>
            <Col xs={6} md={3}>
              <Card className="stat-card-mini stat-card-progress">
                <Card.Body>
                  <div className="stat-mini-icon">
                    <i className="fas fa-spinner"></i>
                  </div>
                  <div className="stat-mini-value">{stats.inProgress}</div>
                  <div className="stat-mini-label">In Progress</div>
                </Card.Body>
              </Card>
            </Col>
            <Col xs={6} md={3}>
              <Card className="stat-card-mini stat-card-notstarted">
                <Card.Body>
                  <div className="stat-mini-icon">
                    <i className="fas fa-play-circle"></i>
                  </div>
                  <div className="stat-mini-value">{stats.notStarted}</div>
                  <div className="stat-mini-label">Not Started</div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </>
        )}

        {/* Course Grid */}
        {filteredMaterials.length === 0 ? (
          <div className="training-empty">
            <i className="fas fa-graduation-cap"></i>
            <h3>No courses found</h3>
            <p>Try adjusting your search or filters</p>
          </div>
        ) : (
          <>
            <Row>
              {filteredMaterials.slice(0, visibleCourses).map(material => (
              <Col lg={4} md={6} key={material._id} className="mb-4">
                <Card className="course-card" onClick={() => { setSelectedMaterial(material); setShowDetailModal(true); }}>
                  {/* Course Thumbnail */}
                  <div className="course-thumbnail">
                    {/* Thumbnail Image or Gradient */}
                    {material.thumbnailUrl ? (
                      <OptimizedImage 
                        src={material.thumbnailUrl} 
                        alt={material.title} 
                        className="course-thumbnail-img" 
                      />
                    ) : (
                      <div className="course-thumbnail-gradient">
                        <div className="course-icon">
                          <i className={material.mimeType?.includes('video') ? 'fas fa-video' : material.mimeType?.includes('pdf') ? 'fas fa-file-pdf' : 'fas fa-book'}></i>
                        </div>
                      </div>
                    )}
                    
                    {/* Overlay Badges */}
                    <div className="course-thumbnail-overlay">
                      <div className="course-category-badge">{material.category || 'General'}</div>
                      {material.isMandatory && (
                        <div className="course-mandatory-badge">
                          <i className="fas fa-exclamation-circle"></i> Mandatory
                        </div>
                      )}
                    </div>
                  </div>

                  <Card.Body>
                    <h5 className="course-title">{material.title}</h5>
                    <p className="course-description">{material.description || 'No description available'}</p>

                    {/* Course Meta */}
                    <div className="course-meta">
                      {material.estimatedMinutes > 0 && (
                        <span><i className="far fa-clock"></i> {material.estimatedMinutes} min</span>
                      )}
                      {material.averageRating > 0 && (
                        <span><i className="fas fa-star"></i> {material.averageRating.toFixed(1)}</span>
                      )}
                    </div>

                    {/* Progress Bar for Employees */}
                    {!isAdmin && (
                      <div className="course-progress">
                        {material.progress?.status === 'COMPLETED' ? (
                          <Badge bg="success" className="w-100 py-2">
                            <i className="fas fa-check-circle me-2"></i>Completed
                          </Badge>
                        ) : material.progress?.status === 'IN_PROGRESS' ? (
                          <Badge bg="warning" className="w-100 py-2">
                            <i className="fas fa-spinner me-2"></i>In Progress
                          </Badge>
                        ) : (
                          <Badge bg="secondary" className="w-100 py-2">
                            <i className="fas fa-play-circle me-2"></i>Not Started
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Admin Actions */}
                    {isAdmin && (
                      <div className="course-admin-actions" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="outline-primary" onClick={() => handleEdit(material)}>
                          <i className="fas fa-edit"></i>
                        </Button>
                        <Button size="sm" variant="outline-info" onClick={() => openProgressModal(material)}>
                          <i className="fas fa-chart-bar"></i>
                        </Button>
                        <Button size="sm" variant="outline-danger" onClick={() => handleDelete(material._id)}>
                          <i className="fas fa-trash"></i>
                        </Button>
                      </div>
                    )}

                    {/* Manager Actions */}
                    {!isAdmin && user?.role === 'MANAGER' && (
                      <div className="course-admin-actions" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="outline-info" onClick={() => openProgressModal(material)} className="w-100">
                          <i className="fas fa-certificate me-1"></i> Manage Certificates
                        </Button>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
          
          {/* Loading More Indicator */}
          {visibleCourses < filteredMaterials.length && (
            <div className="text-center my-4">
              <div className="spinner-border text-success" role="status">
                <span className="visually-hidden">Loading more...</span>
              </div>
              <p className="text-muted mt-2">Loading more courses...</p>
            </div>
          )}
          
          {/* Showing X of Y */}
          {filteredMaterials.length > 12 && (
            <div className="text-center my-3">
              <small className="text-muted">
                Showing {Math.min(visibleCourses, filteredMaterials.length)} of {filteredMaterials.length} courses
              </small>
            </div>
          )}
        </>
        )}
      </Container>

      {/* Course Detail Modal */}
      <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} size="lg" centered>
        <Modal.Body className="course-detail-modal">
          {selectedMaterial && (
            <>
              <button className="modal-close-btn" onClick={() => setShowDetailModal(false)}>
                <i className="fas fa-times"></i>
              </button>

              <div className="course-detail-header">
                <div className="course-detail-icon">
                  <i className={selectedMaterial.mimeType?.includes('video') ? 'fas fa-video' : selectedMaterial.mimeType?.includes('pdf') ? 'fas fa-file-pdf' : 'fas fa-book'}></i>
                </div>
                <div>
                  <h2>{selectedMaterial.title}</h2>
                  <div className="course-detail-meta">
                    <span className="badge-category">{selectedMaterial.category || 'General'}</span>
                    {selectedMaterial.estimatedMinutes > 0 && (
                      <span><i className="far fa-clock"></i> {selectedMaterial.estimatedMinutes} min</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="course-detail-body">
                <h6>About this course</h6>
                <p>{selectedMaterial.description || 'No description available'}</p>

                {selectedMaterial.dueDate && (
                  <div className="course-due-date">
                    <i className="fas fa-calendar-alt"></i>
                    <span>Due: {new Date(selectedMaterial.dueDate).toLocaleDateString()}</span>
                  </div>
                )}

                {/* Additional Files Section */}
                {selectedMaterial.additionalFiles && selectedMaterial.additionalFiles.length > 0 && (
                  <div className="additional-files-section mt-3">
                    <h6><i className="fas fa-paperclip me-2"></i>Course Materials ({selectedMaterial.additionalFiles.length})</h6>
                    <div className="additional-files-list">
                      {selectedMaterial.additionalFiles.map((file, idx) => (
                        <div key={idx} className="additional-file-item">
                          <div className="file-info">
                            <i className={`fas ${file.mimeType?.includes('video') ? 'fa-video' : file.mimeType?.includes('pdf') ? 'fa-file-pdf' : 'fa-file'} me-2`}></i>
                            <span>{file.originalName}</span>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline-primary"
                            onClick={async () => {
                              try {
                                const res = await api.get(`/api/training/${selectedMaterial._id}/download-additional/${idx}?preview=true`);
                                window.open(res.data.downloadUrl, '_blank');
                              } catch (err) {
                                toast.error('Failed to open file');
                              }
                            }}
                          >
                            <i className="fas fa-external-link-alt"></i>
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Progress Section for Admins/Managers */}
                {canManageCertificates && (
                  <div className="course-progress-section">
                    <h6 className="progress-section-title">
                      <i className="fas fa-chart-line me-2"></i>
                      Course Progress
                    </h6>
                    
                    {/* Mini Progress Stats */}
                    <Row className="mb-3">
                      <Col xs={4}>
                        <div className="mini-progress-stat completed">
                          <i className="fas fa-check-circle"></i>
                          <div className="mini-stat-value">{progressData.filter(p => p.status === 'COMPLETED').length}</div>
                          <div className="mini-stat-label">Completed</div>
                        </div>
                      </Col>
                      <Col xs={4}>
                        <div className="mini-progress-stat inprogress">
                          <i className="fas fa-spinner"></i>
                          <div className="mini-stat-value">{progressData.filter(p => p.status === 'IN_PROGRESS').length}</div>
                          <div className="mini-stat-label">In Progress</div>
                        </div>
                      </Col>
                      <Col xs={4}>
                        <div className="mini-progress-stat notstarted">
                          <i className="fas fa-play-circle"></i>
                          <div className="mini-stat-value">{progressData.filter(p => p.status === 'NOT_STARTED').length}</div>
                          <div className="mini-stat-label">Not Started</div>
                        </div>
                      </Col>
                    </Row>

                    {/* Mini Progress Bar */}
                    {progressData.length > 0 && (
                      <div className="mini-progress-bar-wrapper">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="mini-progress-label">Overall Completion</span>
                          <span className="mini-progress-percentage">
                            {Math.round((progressData.filter(p => p.status === 'COMPLETED').length / progressData.length) * 100)}%
                          </span>
                        </div>
                        <div className="progress-bar-modern" style={{ height: '8px' }}>
                          <div 
                            className="progress-bar-fill"
                            style={{ width: `${(progressData.filter(p => p.status === 'COMPLETED').length / progressData.length) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {/* View Full Progress Button */}
                    <Button 
                      variant="outline-primary" 
                      size="sm" 
                      className="mt-3 w-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDetailModal(false);
                        openProgressModal(selectedMaterial);
                      }}
                    >
                      <i className="fas fa-users me-2"></i>
                      View All Employee Progress
                    </Button>
                  </div>
                )}

                {/* Employee Actions */}
                {!canManageCertificates && (
                  <div className="course-detail-actions">
                    <Button variant="primary" size="lg" onClick={() => handlePreview(selectedMaterial)}>
                      <i className="fas fa-play-circle me-2"></i>
                      {selectedMaterial.mimeType?.includes('video') ? 'Watch Now' : 'View Course'}
                    </Button>

                    {selectedMaterial.progress?.status === 'COMPLETED' && progressData[0]?.certificate ? (
                      <Button variant="outline-success" onClick={() => handleDownloadCertificate(selectedMaterial._id)}>
                        <i className="fas fa-certificate me-2"></i>Download Certificate
                      </Button>
                    ) : selectedMaterial.progress?.status === 'COMPLETED' ? (
                      <Button variant="outline-secondary" disabled>
                        <i className="fas fa-clock me-2"></i>Certificate Pending
                      </Button>
                    ) : (
                      <Button
                        variant={selectedMaterial.progress?.status === 'IN_PROGRESS' ? 'success' : 'outline-primary'}
                        onClick={() => handleProgressUpdate(selectedMaterial._id, selectedMaterial.progress?.status === 'IN_PROGRESS' ? 'COMPLETED' : 'IN_PROGRESS')}
                      >
                        <i className={`fas ${selectedMaterial.progress?.status === 'IN_PROGRESS' ? 'fa-check' : 'fa-play'} me-2`}></i>
                        {selectedMaterial.progress?.status === 'IN_PROGRESS' ? 'Mark Complete' : 'Start Course'}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </Modal.Body>
      </Modal>

      {/* Upload/Edit Modal */}
      <Modal show={showUploadModal} onHide={() => { setShowUploadModal(false); resetForm(); }} size="lg" centered scrollable>
        <Modal.Header closeButton className="modal-header-green">
          <Modal.Title>
            <i className={`fas ${editMode ? 'fa-edit' : 'fa-plus-circle'} me-2`}></i>
            {editMode ? 'Edit Course' : 'Add New Course'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleUpload}>
          <Modal.Body className="modal-body-modern">
            {/* Course Title */}
            <div className="form-section">
              <div className="form-section-header">
                <i className="fas fa-graduation-cap"></i>
                <span>Course Information</span>
              </div>
              
              <Form.Group className="mb-3">
                <Form.Label>Course Title <span className="text-danger">*</span></Form.Label>
                <Form.Control 
                  className="form-control-modern"
                  value={form.title} 
                  onChange={e => setForm({ ...form, title: e.target.value })} 
                  placeholder="Enter course title"
                  required 
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Description</Form.Label>
                <Form.Control 
                  as="textarea" 
                  rows={3} 
                  className="form-control-modern"
                  value={form.description} 
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe what students will learn..."
                />
              </Form.Group>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Category</Form.Label>
                    <Form.Control 
                      className="form-control-modern"
                      value={form.category} 
                      onChange={e => setForm({ ...form, category: e.target.value })} 
                      placeholder="e.g., Technical, HR, Sales"
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Duration (minutes)</Form.Label>
                    <InputGroup>
                      <Form.Control 
                        type="number" 
                        className="form-control-modern"
                        value={form.estimatedMinutes} 
                        onChange={e => setForm({ ...form, estimatedMinutes: e.target.value })}
                        placeholder="30"
                      />
                      <InputGroup.Text className="input-group-modern">
                        <i className="far fa-clock"></i>
                      </InputGroup.Text>
                    </InputGroup>
                  </Form.Group>
                </Col>
              </Row>
            </div>

            {/* Course Content */}
            <div className="form-section">
              <div className="form-section-header">
                <i className="fas fa-file-upload"></i>
                <span>Course Content</span>
              </div>
              
              <Form.Group className="mb-3">
                <Form.Label>Course Thumbnail (Optional)</Form.Label>
                <div className="file-upload-wrapper thumbnail-upload">
                  <Form.Control 
                    type="file" 
                    onChange={e => setForm({ ...form, thumbnail: e.target.files[0] })} 
                    accept="image/*"
                    className="file-input-modern"
                  />
                  <div className="file-upload-label">
                    <i className="fas fa-image"></i>
                    <span>{form.thumbnail ? form.thumbnail.name : 'Choose thumbnail image'}</span>
                    <small>JPG, PNG, GIF - Recommended: 800x450px</small>
                  </div>
                </div>
                {editMode && selectedMaterial?.thumbnailUrl && !form.thumbnail && (
                  <div className="current-thumbnail-preview mt-2">
                    <small className="text-muted">Current thumbnail:</small>
                    <img src={selectedMaterial.thumbnailUrl} alt="Current thumbnail" className="thumbnail-preview-img" />
                  </div>
                )}
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Upload Course Materials</Form.Label>
                <div className="file-upload-wrapper">
                  <Form.Control 
                    type="file" 
                    multiple
                    onChange={e => setForm({ ...form, files: Array.from(e.target.files) })} 
                    accept=".pdf,.mp4,.webm,.mov,.ppt,.pptx,.doc,.docx"
                    className="file-input-modern"
                  />
                  <div className="file-upload-label">
                    <i className="fas fa-cloud-upload-alt"></i>
                    <span>{form.files.length > 0 ? `${form.files.length} file(s) selected` : 'Choose one or multiple files'}</span>
                    <small>PDF, Video, PPT, Word - Max 50MB per file</small>
                  </div>
                </div>
                {form.files.length > 0 && (
                  <div className="mt-2">
                    <small className="text-muted d-block mb-1">Selected files:</small>
                    <ul className="list-unstyled">
                      {form.files.map((file, idx) => (
                        <li key={idx} className="d-flex align-items-center gap-2 mb-1">
                          <i className="fas fa-file text-primary"></i>
                          <small>{file.name}</small>
                          <Button 
                            size="sm" 
                            variant="link" 
                            className="text-danger p-0"
                            onClick={() => setForm({ ...form, files: form.files.filter((_, i) => i !== idx) })}
                          >
                            <i className="fas fa-times"></i>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {editMode && selectedMaterial?.additionalFiles?.length > 0 && (
                  <small className="text-muted d-block mt-2">
                    Current files will be kept. New files will be added.
                  </small>
                )}
              </Form.Group>

              <div className="divider-text">
                <span>OR</span>
              </div>

              <Form.Group className="mb-3">
                <Form.Label>External URL (YouTube, Vimeo, etc.)</Form.Label>
                <InputGroup>
                  <InputGroup.Text className="input-group-modern">
                    <i className="fas fa-link"></i>
                  </InputGroup.Text>
                  <Form.Control 
                    type="url" 
                    className="form-control-modern"
                    value={form.externalUrl} 
                    onChange={e => setForm({ ...form, externalUrl: e.target.value })} 
                    placeholder="https://youtube.com/watch?v=..."
                  />
                </InputGroup>
                <small className="text-muted">Use this for external videos or content hosted elsewhere</small>
              </Form.Group>
            </div>

            {/* Course Settings */}
            <div className="form-section">
              <div className="form-section-header">
                <i className="fas fa-cog"></i>
                <span>Course Settings</span>
              </div>
              
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <div className="custom-checkbox-wrapper">
                      <Form.Check 
                        type="checkbox" 
                        id="mandatory-check"
                        label="Mandatory Training" 
                        checked={form.isMandatory} 
                        onChange={e => setForm({ ...form, isMandatory: e.target.checked })}
                        className="custom-checkbox"
                      />
                      <small className="text-muted d-block mt-1">Require all employees to complete</small>
                    </div>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Due Date</Form.Label>
                    <InputGroup>
                      <InputGroup.Text className="input-group-modern">
                        <i className="far fa-calendar"></i>
                      </InputGroup.Text>
                      <Form.Control 
                        type="date" 
                        className="form-control-modern"
                        value={form.dueDate} 
                        onChange={e => setForm({ ...form, dueDate: e.target.value })}
                      />
                    </InputGroup>
                  </Form.Group>
                </Col>
              </Row>
            </div>

            {/* Target Audience */}
            <div className="form-section">
              <div className="form-section-header">
                <i className="fas fa-users"></i>
                <span>Target Audience</span>
              </div>
              
              <Form.Group className="mb-3">
                <Form.Label>Target Roles</Form.Label>
                <div className="role-chips">
                  {['EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'].map(role => (
                    <label key={role} className={`role-chip ${form.targetRoles.includes(role) ? 'active' : ''}`}>
                      <input
                        type="checkbox"
                        checked={form.targetRoles.includes(role)}
                        onChange={e => setForm(f => ({
                          ...f,
                          targetRoles: e.target.checked ? [...f.targetRoles, role] : f.targetRoles.filter(r => r !== role)
                        }))}
                      />
                      <i className="fas fa-check"></i>
                      <span>{role}</span>
                    </label>
                  ))}
                </div>
                <small className="text-muted">Leave empty to make visible to everyone</small>
              </Form.Group>
            </div>
          </Modal.Body>
          <Modal.Footer className="modal-footer-modern">
            <Button variant="outline-secondary" onClick={() => { setShowUploadModal(false); resetForm(); }} className="btn-cancel-modern">
              <i className="fas fa-times me-2"></i>Cancel
            </Button>
            <Button variant="primary" type="submit" className="btn-submit-modern">
              <i className={`fas ${editMode ? 'fa-save' : 'fa-plus-circle'} me-2`}></i>
              {editMode ? 'Update Course' : 'Create Course'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Progress Modal */}
      <Modal show={showProgressModal} onHide={() => setShowProgressModal(false)} size="lg" centered scrollable>
        <Modal.Header closeButton className="modal-header-green">
          <Modal.Title>
            <i className="fas fa-chart-line me-2"></i>
            Course Progress - {selectedMaterial?.title}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="modal-body-modern">
          {progressData.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-users-slash"></i>
              <h5>No Progress Data</h5>
              <p className="text-muted">No employees have started this course yet</p>
            </div>
          ) : (
            <>
              {/* Progress Summary */}
              <div className="progress-summary">
                <Row>
                  <Col md={4}>
                    <div className="progress-stat-box">
                      <div className="progress-stat-icon completed">
                        <i className="fas fa-check-circle"></i>
                      </div>
                      <div className="progress-stat-info">
                        <div className="progress-stat-value">{progressData.filter(p => p.status === 'COMPLETED').length}</div>
                        <div className="progress-stat-label">Completed</div>
                      </div>
                    </div>
                  </Col>
                  <Col md={4}>
                    <div className="progress-stat-box">
                      <div className="progress-stat-icon inprogress">
                        <i className="fas fa-spinner"></i>
                      </div>
                      <div className="progress-stat-info">
                        <div className="progress-stat-value">{progressData.filter(p => p.status === 'IN_PROGRESS').length}</div>
                        <div className="progress-stat-label">In Progress</div>
                      </div>
                    </div>
                  </Col>
                  <Col md={4}>
                    <div className="progress-stat-box">
                      <div className="progress-stat-icon notstarted">
                        <i className="fas fa-play-circle"></i>
                      </div>
                      <div className="progress-stat-info">
                        <div className="progress-stat-value">{progressData.filter(p => p.status === 'NOT_STARTED').length}</div>
                        <div className="progress-stat-label">Not Started</div>
                      </div>
                    </div>
                  </Col>
                </Row>

                {/* Overall Progress Bar */}
                <div className="overall-progress-wrapper">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="progress-label">Overall Completion</span>
                    <span className="progress-percentage">
                      {Math.round((progressData.filter(p => p.status === 'COMPLETED').length / progressData.length) * 100)}%
                    </span>
                  </div>
                  <div className="progress-bar-modern">
                    <div 
                      className="progress-bar-fill"
                      style={{ width: `${(progressData.filter(p => p.status === 'COMPLETED').length / progressData.length) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Employee List */}
              <div className="employee-progress-list">
                <h6 className="list-header">
                  <i className="fas fa-users me-2"></i>
                  Employee Progress ({progressData.length})
                </h6>
                {progressData.filter(p => p.userId).map(p => (
                  <div key={p._id} className="employee-progress-item">
                    <div className="employee-info">
                      <div className="employee-avatar">
                        {p.userId?.firstName?.charAt(0) || 'U'}{p.userId?.lastName?.charAt(0) || 'U'}
                      </div>
                      <div className="employee-details">
                        <div className="employee-name">{p.userId?.firstName || 'Unknown'} {p.userId?.lastName || 'User'}</div>
                        <div className="employee-email">{p.userId?.email || 'No email'}</div>
                        {p.completedAt && (
                          <div className="completion-date">
                            <i className="far fa-calendar-check me-1"></i>
                            Completed on {new Date(p.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        )}
                        {p.certificate && (
                          <div className="certificate-info mt-2">
                            <Badge bg="success" className="me-2">
                              <i className="fas fa-certificate me-1"></i>
                              Certificate Uploaded
                            </Badge>
                            <small className="text-muted">
                              {new Date(p.certificate.uploadedAt).toLocaleDateString()}
                            </small>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="employee-actions">
                      <div className="employee-status mb-2">
                        <Badge 
                          bg={p.status === 'COMPLETED' ? 'success' : p.status === 'IN_PROGRESS' ? 'warning' : 'secondary'}
                          className="status-badge-modern"
                        >
                          <i className={`fas ${p.status === 'COMPLETED' ? 'fa-check-circle' : p.status === 'IN_PROGRESS' ? 'fa-spinner' : 'fa-play-circle'} me-1`}></i>
                          {p.status === 'COMPLETED' ? 'Completed' : p.status === 'IN_PROGRESS' ? 'In Progress' : 'Not Started'}
                        </Badge>
                      </div>
                      {p.certificate ? (
                        <div className="d-flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline-primary"
                            onClick={async () => {
                              try {
                                // Get the signed URL for the uploaded certificate
                                const params = {
                                  Bucket: process.env.REACT_APP_AWS_S3_BUCKET || 'krishigyan-hr-management',
                                  Key: p.certificate.s3Key,
                                  Expires: 3600
                                };
                                // Since we can't access S3 directly from frontend, use the download endpoint
                                window.open(p.certificate.s3Url, '_blank');
                              } catch (err) {
                                toast.error('Failed to view certificate');
                              }
                            }}
                          >
                            <i className="fas fa-eye"></i>
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline-danger"
                            onClick={() => handleDeleteCertificate(selectedMaterial._id, p.userId._id)}
                          >
                            <i className="fas fa-trash"></i>
                          </Button>
                        </div>
                      ) : (
                        <div>
                          <input
                            type="file"
                            id={`cert-${p._id}`}
                            accept=".pdf,.jpg,.jpeg,.png"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              if (e.target.files[0]) {
                                handleUploadCertificate(selectedMaterial._id, p.userId._id, e.target.files[0]);
                              }
                            }}
                          />
                          <Button 
                            size="sm" 
                            variant="outline-success"
                            onClick={() => document.getElementById(`cert-${p._id}`).click()}
                            disabled={uploadingCertificate === `${selectedMaterial._id}-${p.userId._id}`}
                          >
                            {uploadingCertificate === `${selectedMaterial._id}-${p.userId._id}` ? (
                              <><i className="fas fa-spinner fa-spin me-1"></i>Uploading...</>
                            ) : (
                              <><i className="fas fa-upload me-1"></i>Upload Certificate</>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer className="modal-footer-modern">
          <Button variant="outline-secondary" onClick={() => setShowProgressModal(false)} className="btn-cancel-modern">
            <i className="fas fa-times me-2"></i>Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Leaderboard Modal */}
      <Modal show={showLeaderboard} onHide={() => setShowLeaderboard(false)} size="lg" centered>
        <Modal.Header closeButton className="modal-header-green">
          <Modal.Title>
            <i className="fas fa-trophy me-2"></i>
            Leaderboard - Top Learners
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="modal-body-modern">
          {/* Period Selector */}
          <div className="d-flex gap-2 mb-4 justify-content-center">
            <Button 
              size="sm" 
              variant={leaderboardPeriod === 'week' ? 'primary' : 'outline-secondary'}
              onClick={() => { setLeaderboardPeriod('week'); fetchLeaderboard('week'); }}
            >
              This Week
            </Button>
            <Button 
              size="sm" 
              variant={leaderboardPeriod === 'month' ? 'primary' : 'outline-secondary'}
              onClick={() => { setLeaderboardPeriod('month'); fetchLeaderboard('month'); }}
            >
              This Month
            </Button>
            <Button 
              size="sm" 
              variant={leaderboardPeriod === 'all' ? 'primary' : 'outline-secondary'}
              onClick={() => { setLeaderboardPeriod('all'); fetchLeaderboard('all'); }}
            >
              All Time
            </Button>
          </div>

          {leaderboardData.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-trophy"></i>
              <h5>No Data Yet</h5>
              <p className="text-muted">Complete courses to appear on the leaderboard!</p>
            </div>
          ) : (
            <div className="leaderboard-list">
              {leaderboardData.map((entry, index) => (
                <div key={entry._id} className={`leaderboard-item rank-${index + 1}`}>
                  <div className="leaderboard-rank">
                    {index === 0 && <i className="fas fa-crown" style={{ color: '#fbbf24' }}></i>}
                    {index === 1 && <i className="fas fa-medal" style={{ color: '#c0c0c0' }}></i>}
                    {index === 2 && <i className="fas fa-medal" style={{ color: '#cd7f32' }}></i>}
                    {index > 2 && <span>#{index + 1}</span>}
                  </div>
                  <div className="leaderboard-avatar">
                    {entry.firstName?.charAt(0)}{entry.lastName?.charAt(0)}
                  </div>
                  <div className="leaderboard-info">
                    <div className="leaderboard-name">{entry.firstName} {entry.lastName}</div>
                    <div className="leaderboard-email">{entry.email}</div>
                  </div>
                  <div className="leaderboard-stats">
                    <div className="leaderboard-stat">
                      <i className="fas fa-check-circle text-success me-1"></i>
                      <strong>{entry.completedCount}</strong> courses
                    </div>
                    {entry.totalTimeSpent > 0 && (
                      <div className="leaderboard-stat">
                        <i className="far fa-clock text-primary me-1"></i>
                        <strong>{Math.round(entry.totalTimeSpent / 60)}h {entry.totalTimeSpent % 60}m</strong>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="modal-footer-modern">
          <Button variant="outline-secondary" onClick={() => setShowLeaderboard(false)} className="btn-cancel-modern">
            <i className="fas fa-times me-2"></i>Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default TrainingMaterials;
