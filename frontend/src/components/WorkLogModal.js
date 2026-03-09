import React from 'react';
import { Modal, Form, Button, Card, Row, Col, Badge } from 'react-bootstrap';

const WorkLogModal = ({ 
  show, 
  onHide, 
  onSubmit, 
  bulkLogs, 
  setBulkLogs,
  selectedTemplate,
  setSelectedTemplate,
  TEMPLATES,
  loadingStates,
  addBulkLogEntry,
  removeBulkLogEntry,
  updateBulkLogEntry,
  renderTemplateField
}) => {
  
  return (
    <Modal show={show} onHide={onHide} size="xl" centered>
      <Modal.Header closeButton style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', borderBottom: 'none'}}>
        <Modal.Title style={{fontSize: '1.3rem', fontWeight: '600'}}>
          <i className="fas fa-clipboard-list me-2"></i>Daily Work Report
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={onSubmit}>
        <Modal.Body style={{maxHeight: '75vh', overflowY: 'auto', padding: '2rem', background: '#f8f9fa'}}>
          <div className="alert" style={{background: 'linear-gradient(135deg, #e0e7ff 0%, #e9d5ff 100%)', border: '1px solid #c7d2fe', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
              <div style={{width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <i className="fas fa-info-circle" style={{color: 'white', fontSize: '1.2rem'}}></i>
              </div>
              <div>
                <div style={{fontWeight: '600', color: '#4c1d95', marginBottom: '0.25rem'}}>Daily Work Report</div>
                <small style={{color: '#6b21a8'}}>This report will be sent to your manager</small>
              </div>
            </div>
          </div>

          <Card className="mb-4" style={{border: '2px solid #667eea', borderRadius: '12px'}}>
            <Card.Body style={{padding: '1.5rem'}}>
              <Form.Group>
                <Form.Label style={{fontWeight: '600', color: '#374151', fontSize: '1rem', marginBottom: '1rem'}}>
                  <i className="fas fa-layer-group me-2" style={{color: '#667eea'}}></i>Select Report Template
                </Form.Label>
                <Form.Select 
                  value={selectedTemplate} 
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  style={{borderRadius: '8px', border: '2px solid #e5e7eb', padding: '0.75rem', fontSize: '1rem', fontWeight: '500'}}
                >
                  {Object.keys(TEMPLATES).map(key => (
                    <option key={key} value={key}>{TEMPLATES[key].name}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Card.Body>
          </Card>

          {bulkLogs.map((log, index) => (
            <Card key={index} className="mb-3" style={{border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)'}}>
              <Card.Body style={{padding: '1.5rem', background: 'white'}}>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="mb-0" style={{color: '#1f2937', fontWeight: '600', fontSize: '1rem'}}>
                    <i className="fas fa-tasks me-2" style={{color: '#667eea'}}></i>Task {index + 1}
                  </h6>
                  {bulkLogs.length > 1 && (
                    <Button variant="outline-danger" size="sm" onClick={() => removeBulkLogEntry(index)} style={{borderRadius: '8px'}}>
                      <i className="fas fa-trash me-1"></i>Remove
                    </Button>
                  )}
                </div>

                <Row className="mb-3">
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label style={{fontWeight: '600', color: '#374151', fontSize: '0.9rem'}}>
                        <i className="fas fa-calendar me-2" style={{color: '#667eea'}}></i>Date <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control 
                        type="date" 
                        value={log.date} 
                        onChange={(e) => updateBulkLogEntry(index, 'date', e.target.value)} 
                        required
                        style={{borderRadius: '8px', border: '2px solid #e5e7eb', padding: '0.6rem', fontSize: '0.9rem'}}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label style={{fontWeight: '600', color: '#374151', fontSize: '0.9rem'}}>
                        <i className="fas fa-check-circle me-2" style={{color: '#667eea'}}></i>Status <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Select 
                        value={log.status} 
                        onChange={(e) => updateBulkLogEntry(index, 'status', e.target.value)}
                        required
                        style={{borderRadius: '8px', border: '2px solid #e5e7eb', padding: '0.6rem', fontSize: '0.9rem'}}
                      >
                        <option value="COMPLETED">Completed</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="BLOCKED">Blocked</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label style={{fontWeight: '600', color: '#374151', fontSize: '0.9rem'}}>
                        <i className="fas fa-map-marker-alt me-2" style={{color: '#667eea'}}></i>Location <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Select 
                        value={log.location} 
                        onChange={(e) => updateBulkLogEntry(index, 'location', e.target.value)}
                        required
                        style={{borderRadius: '8px', border: '2px solid #e5e7eb', padding: '0.6rem', fontSize: '0.9rem'}}
                      >
                        <option value="OFFICE">Office</option>
                        <option value="REMOTE">Remote</option>
                        <option value="CLIENT_SITE">Client Site</option>
                        <option value="FIELD">Field</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>

                <Row className="mb-3">
                  {TEMPLATES[selectedTemplate].fields.filter(f => !['workDone', 'deliverables', 'hoursSpent', 'status', 'location', 'date', 'issues'].includes(f)).map(field => 
                    renderTemplateField(log, index, field)
                  )}
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label style={{fontWeight: '600', color: '#374151', fontSize: '0.9rem'}}>
                        <i className="fas fa-clock me-2" style={{color: '#667eea'}}></i>Hours Spent <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control 
                        type="number" 
                        step="0.5" 
                        min="0" 
                        max="12" 
                        value={log.hoursSpent} 
                        onChange={(e) => updateBulkLogEntry(index, 'hoursSpent', e.target.value)} 
                        placeholder="2.5"
                        required
                        style={{borderRadius: '8px', border: '2px solid #e5e7eb', padding: '0.6rem', fontSize: '0.9rem'}}
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3">
                  <Form.Label style={{fontWeight: '600', color: '#374151', fontSize: '0.9rem'}}>
                    <i className="fas fa-file-alt me-2" style={{color: '#667eea'}}></i>Work Description <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control 
                    as="textarea" 
                    rows={2} 
                    value={log.workDone} 
                    onChange={(e) => updateBulkLogEntry(index, 'workDone', e.target.value)} 
                    placeholder="Describe the work completed..."
                    required
                    style={{borderRadius: '8px', border: '2px solid #e5e7eb', padding: '0.75rem', fontSize: '0.9rem'}}
                  />
                </Form.Group>

                {TEMPLATES[selectedTemplate].fields.includes('deliverables') && (
                  <Form.Group className="mb-3">
                    <Form.Label style={{fontWeight: '600', color: '#374151', fontSize: '0.9rem'}}>
                      <i className="fas fa-trophy me-2" style={{color: '#10b981'}}></i>Deliverables/Outcomes
                    </Form.Label>
                    <Form.Control 
                      as="textarea" 
                      rows={2} 
                      value={log.deliverables} 
                      onChange={(e) => updateBulkLogEntry(index, 'deliverables', e.target.value)} 
                      placeholder="What was delivered or achieved?"
                      style={{borderRadius: '8px', border: '2px solid #e5e7eb', padding: '0.75rem', fontSize: '0.9rem'}}
                    />
                  </Form.Group>
                )}

                {(log.status === 'BLOCKED' || log.status === 'IN_PROGRESS') && (
                  <Form.Group className="mb-2">
                    <Form.Label style={{fontWeight: '600', color: '#374151', fontSize: '0.9rem'}}>
                      <i className="fas fa-exclamation-triangle me-2" style={{color: '#ef4444'}}></i>Blockers/Issues {log.status === 'BLOCKED' && <span className="text-danger">*</span>}
                    </Form.Label>
                    <Form.Control 
                      as="textarea" 
                      rows={2} 
                      value={log.issues} 
                      onChange={(e) => updateBulkLogEntry(index, 'issues', e.target.value)} 
                      placeholder="Describe any problems or blockers faced..."
                      required={log.status === 'BLOCKED'}
                      style={{borderRadius: '8px', border: '2px solid #fee2e2', padding: '0.75rem', fontSize: '0.9rem', background: '#fef2f2'}}
                    />
                  </Form.Group>
                )}
              </Card.Body>
            </Card>
          ))}
          
          <Button 
            variant="outline-primary" 
            onClick={addBulkLogEntry} 
            className="w-100" 
            style={{borderRadius: '10px', padding: '0.75rem', fontWeight: '600', border: '2px dashed #667eea', color: '#667eea', background: 'white'}}
          >
            <i className="fas fa-plus-circle me-2"></i>Add Another Task
          </Button>
        </Modal.Body>
        <Modal.Footer style={{background: 'white', borderTop: '2px solid #e5e7eb', padding: '1.25rem 2rem'}}>
          <Button 
            variant="light" 
            onClick={onHide} 
            style={{padding: '0.75rem 1.5rem', fontSize: '0.95rem', fontWeight: '600', borderRadius: '10px', border: '2px solid #e5e7eb'}}
          >
            Cancel
          </Button>
          <Button 
            variant="primary" 
            type="submit" 
            disabled={loadingStates.worklog}
            style={{padding: '0.75rem 2rem', fontSize: '0.95rem', fontWeight: '600', borderRadius: '10px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none', boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'}}
          >
            {loadingStates.worklog ? (
              <><span className="spinner-border spinner-border-sm me-2"></span>Submitting Report...</>
            ) : (
              <><i className="fas fa-paper-plane me-2"></i>Submit Report</>
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default WorkLogModal;
