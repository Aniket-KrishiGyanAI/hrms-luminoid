import React, { useState, useEffect } from 'react';
import { Badge, Dropdown, Modal, Form, Button, Row, Col } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { toast } from 'react-toastify';
import './DailyUpdates.css';

const DailyUpdates = () => {
  const { user } = useAuth();
  const [news, setNews] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'general',
    priority: 'low',
    tags: ''
  });

  const canAddNews = ['ADMIN', 'HR', 'MANAGER'].includes(user?.role);
  const canDelete = ['ADMIN', 'HR', 'MANAGER'].includes(user?.role);

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/daily-updates');
      setNews(response.data || []);
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const tagsArray = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      await api.post('/api/daily-updates', {
        title: formData.title,
        content: formData.content,
        category: formData.category,
        priority: formData.priority,
        tags: tagsArray
      });

      toast.success('News update posted successfully!');
      setShowModal(false);
      resetForm();
      fetchNews();
    } catch (error) {
      toast.error('Failed to post update');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      category: 'general',
      priority: 'low',
      tags: ''
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDeleteClick = (id) => {
    setDeleteItemId(id);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await api.delete(`/api/daily-updates/${deleteItemId}`);
      toast.success('News deleted successfully!');
      setShowDeleteModal(false);
      setDeleteItemId(null);
      fetchNews();
    } catch (error) {
      toast.error('Failed to delete news');
    }
  };

  const getCategoryIcon = (category) => {
    const icons = {
      announcement: 'bullhorn',
      policy: 'file-contract',
      achievement: 'trophy',
      event: 'calendar-star',
      training: 'graduation-cap',
      spotlight: 'star',
      general: 'info-circle'
    };
    return icons[category] || 'newspaper';
  };

  const getCategoryColor = (category) => {
    const colors = {
      announcement: '#3b82f6',
      policy: '#8b5cf6',
      achievement: '#f59e0b',
      event: '#10b981',
      training: '#06b6d4',
      spotlight: '#ec4899',
      general: '#6366f1'
    };
    return colors[category] || '#64748b';
  };

  const formatDate = (date) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (date) => {
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  const filteredNews = filter === 'all' 
    ? news 
    : news.filter(item => item.category === filter);

  const featuredNews = filteredNews.length > 0 ? filteredNews[0] : null;
  const regularNews = filteredNews.slice(1);

  if (loading) {
    return (
      <div className="news-loading">
        <div className="spinner-border text-primary" role="status"></div>
        <p>Loading updates...</p>
      </div>
    );
  }

  return (
    <>
      <div className="news-magazine">
        {/* Category Tabs */}
        <div className="news-category-tabs">
          <div className="tabs-wrapper">
            <button 
              className={`category-tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All News
            </button>
            <button 
              className={`category-tab ${filter === 'announcement' ? 'active' : ''}`}
              onClick={() => setFilter('announcement')}
            >
              Announcements
            </button>
            <button 
              className={`category-tab ${filter === 'event' ? 'active' : ''}`}
              onClick={() => setFilter('event')}
            >
              Events
            </button>
            <button 
              className={`category-tab ${filter === 'achievement' ? 'active' : ''}`}
              onClick={() => setFilter('achievement')}
            >
              Achievements
            </button>
            <button 
              className={`category-tab ${filter === 'policy' ? 'active' : ''}`}
              onClick={() => setFilter('policy')}
            >
              Policies
            </button>
          </div>
          {canAddNews && (
            <Button 
              variant="primary" 
              className="btn-add-news"
              onClick={() => setShowModal(true)}
            >
              <i className="fas fa-plus-circle me-2"></i>
              Publish
            </Button>
          )}
        </div>

        {/* News Content */}
        <div className="news-content">
          {filteredNews.length > 0 ? (
            <>
              {/* Featured Article */}
              {featuredNews && (
                <div className="featured-article">
                  {canDelete && (
                    <button 
                      className="news-delete-btn featured-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(featuredNews._id);
                      }}
                      title="Delete this news"
                    >
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  )}
                  <div className="featured-overlay"></div>
                  <div className="featured-content">
                    <div className="featured-meta">
                      <span 
                        className="featured-category"
                        style={{ 
                          background: getCategoryColor(featuredNews.category),
                          color: 'white'
                        }}
                      >
                        <i className={`fas fa-${getCategoryIcon(featuredNews.category)} me-1`}></i>
                        {featuredNews.category}
                      </span>
                      {featuredNews.isPinned && (
                        <span className="featured-pinned">
                          <i className="fas fa-thumbtack me-1"></i>
                          Pinned
                        </span>
                      )}
                    </div>
                    <h2 className="featured-title">{featuredNews.title || 'Featured Update'}</h2>
                    <p className="featured-excerpt">
                      {featuredNews.content.substring(0, 150)}{featuredNews.content.length > 150 ? '...' : ''}
                    </p>
                    <div className="featured-footer">
                      <div className="featured-author">
                        <div className="author-avatar-featured">
                          {featuredNews.userId?.firstName?.charAt(0)}{featuredNews.userId?.lastName?.charAt(0)}
                        </div>
                        <div className="author-details">
                          <span className="author-name-featured">
                            {featuredNews.userId?.firstName} {featuredNews.userId?.lastName}
                          </span>
                          <span className="author-date">
                            {formatDate(featuredNews.createdAt)} • {formatTime(featuredNews.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* News Grid */}
              {regularNews.length > 0 && (
                <div className="news-grid">
                  {regularNews.map((item) => {
                    const categoryColor = getCategoryColor(item.category || 'general');
                    const categoryIcon = getCategoryIcon(item.category || 'general');

                    return (
                      <article key={item._id} className="news-card">
                        {canDelete && (
                          <button 
                            className="news-delete-btn card-delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(item._id);
                            }}
                            title="Delete this news"
                          >
                            <i className="fas fa-trash-alt"></i>
                          </button>
                        )}
                        <div className="news-card-header">
                          <div></div>
                          <div>
                            {item.priority === 'high' && (
                              <span className="news-card-badge urgent">Urgent</span>
                            )}
                            {item.priority === 'medium' && (
                              <span className="news-card-badge important">Important</span>
                            )}
                          </div>
                        </div>
                        <h4 className="news-card-title">{item.title || 'Update'}</h4>
                        <p className="news-card-excerpt">
                          {item.content.substring(0, 100)}{item.content.length > 100 ? '...' : ''}
                        </p>
                        {item.tags && item.tags.length > 0 && (
                          <div className="news-card-tags">
                            {item.tags.slice(0, 2).map((tag, idx) => (
                              <span key={idx} className="news-card-tag">#{tag}</span>
                            ))}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="news-empty-state">
              <div className="empty-illustration">
                <i className="fas fa-newspaper"></i>
              </div>
              <h3>No News Available</h3>
              <p>Stay tuned for company updates and announcements</p>
            </div>
          )}
        </div>
      </div>

      {/* Add News Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
        <Modal.Header closeButton className="news-modal-header">
          <Modal.Title>
            <i className="fas fa-newspaper me-2"></i>
            Publish Company Update
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="news-modal-body">
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Headline <span className="text-danger">*</span></Form.Label>
              <Form.Control
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Enter a compelling headline"
                required
              />
            </Form.Group>

            <Row className="mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Category <span className="text-danger">*</span></Form.Label>
                  <Form.Select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    required
                  >
                    <option value="general">General</option>
                    <option value="announcement">Announcement</option>
                    <option value="policy">Policy Update</option>
                    <option value="achievement">Achievement</option>
                    <option value="event">Event</option>
                    <option value="training">Training</option>
                    <option value="spotlight">Employee Spotlight</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Priority <span className="text-danger">*</span></Form.Label>
                  <Form.Select
                    name="priority"
                    value={formData.priority}
                    onChange={handleChange}
                    required
                  >
                    <option value="low">Low (Info)</option>
                    <option value="medium">Medium (Important)</option>
                    <option value="high">High (Urgent)</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Article Content <span className="text-danger">*</span></Form.Label>
              <Form.Control
                as="textarea"
                rows={6}
                name="content"
                value={formData.content}
                onChange={handleChange}
                placeholder="Write your news article here..."
                required
              />
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label>Tags (Optional)</Form.Label>
              <Form.Control
                type="text"
                name="tags"
                value={formData.tags}
                onChange={handleChange}
                placeholder="e.g., HR, Benefits, Remote, Q1-2024"
              />
              <Form.Text className="text-muted">
                Separate tags with commas
              </Form.Text>
            </Form.Group>

            <div className="d-flex justify-content-end gap-2">
              <Button 
                variant="secondary" 
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                <i className="fas fa-paper-plane me-2"></i>
                Publish Now
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal 
        show={showDeleteModal} 
        onHide={() => setShowDeleteModal(false)} 
        centered
        size="sm"
      >
        <Modal.Header closeButton className="delete-modal-header">
          <Modal.Title>
            <i className="fas fa-exclamation-triangle me-2"></i>
            Confirm Delete
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="delete-modal-body">
          <p>Are you sure you want to delete this news article? This action cannot be undone.</p>
        </Modal.Body>
        <Modal.Footer className="delete-modal-footer">
          <Button 
            variant="secondary" 
            onClick={() => setShowDeleteModal(false)}
          >
            Cancel
          </Button>
          <Button 
            variant="danger" 
            onClick={handleDeleteConfirm}
          >
            <i className="fas fa-trash-alt me-2"></i>
            Delete
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default DailyUpdates;
