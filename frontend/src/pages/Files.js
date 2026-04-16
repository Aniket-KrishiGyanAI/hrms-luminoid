import React, { useState, useEffect } from "react";
import {
  Row,
  Col,
  Card,
  Button,
  Modal,
  Form,
  Table,
  Badge,
  Nav,
} from "react-bootstrap";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import { toast } from "react-toastify";
import Swal from 'sweetalert2';

const Files = () => {
  const { user } = useAuth();

  const defaultFolderForm = { name: '', description: '', accessType: 'FULL', color: '#f59e0b', icon: 'folder', visibility: { type: 'ALL', departments: [], roles: [], employees: [] }, expiryDate: '', maxFileSizeMB: '', allowedFileTypes: [], isPasswordProtected: false, folderPassword: '', tags: '' };

  const FOLDER_COLORS = [
    { color: '#f59e0b', label: 'Amber' }, { color: '#ef4444', label: 'Red' },
    { color: '#3b82f6', label: 'Blue' }, { color: '#10b981', label: 'Green' },
    { color: '#8b5cf6', label: 'Purple' }, { color: '#ec4899', label: 'Pink' },
    { color: '#06b6d4', label: 'Cyan' }, { color: '#64748b', label: 'Slate' }
  ];
  const FOLDER_ICONS = [
    'folder', 'folder-open', 'briefcase', 'archive', 'book', 'file-alt',
    'shield-alt', 'star', 'heart', 'lock', 'users', 'building'
  ];
  const FILE_TYPE_OPTIONS = [
    { value: 'pdf', label: 'PDF', icon: 'fa-file-pdf', color: '#ef4444' },
    { value: 'image', label: 'Images', icon: 'fa-file-image', color: '#8b5cf6' },
    { value: 'word', label: 'Word', icon: 'fa-file-word', color: '#3b82f6' },
    { value: 'excel', label: 'Excel', icon: 'fa-file-excel', color: '#10b981' },
    { value: 'any', label: 'Any', icon: 'fa-file', color: '#64748b' }
  ];

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [fileForm, setFileForm] = useState({
    type: "ORGANIZATION",
    category: "",
    description: "",
    targetUserId: "",
    requiresAcknowledgment: false,
    visibility: { type: "ALL", departments: [], roles: [], employees: [] },
    subType: "",
    month: "",
    year: "",
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [activeTab, setActiveTab] = useState("organization");
  const [showAckModal, setShowAckModal] = useState(false);
  const [ackComments, setAckComments] = useState("");
  const [selectedFileForAck, setSelectedFileForAck] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedFileForVerify, setSelectedFileForVerify] = useState(null);
  const [verifyForm, setVerifyForm] = useState({
    verificationStatus: 'VERIFIED'
  });
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [imgZoom, setImgZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Folder state
  const [folders, setFolders] = useState([]);
  const [activeFolder, setActiveFolder] = useState(null); // { folder, files }
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderForm, setFolderForm] = useState(defaultFolderForm);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignFile, setAssignFile] = useState(null);
  const [editingFolder, setEditingFolder] = useState(null);
  const [folderPasswordInput, setFolderPasswordInput] = useState('');
  const [passwordUnlocked, setPasswordUnlocked] = useState({});
  const [folderStep, setFolderStep] = useState(1);
  const [uploadFolderId, setUploadFolderId] = useState(null);
  const [selectedEmpId, setSelectedEmpId] = useState(null);
  const [orgView, setOrgView] = useState('table');
  const [orgSort, setOrgSort] = useState('date_desc');
  const [orgCategoryFilter, setOrgCategoryFilter] = useState('');
  const [orgVisibilityFilter, setOrgVisibilityFilter] = useState('');
  const [orgSelected, setOrgSelected] = useState([]);
  const [orgFolderFilter, setOrgFolderFilter] = useState('');
  const [orgActiveFolder, setOrgActiveFolder] = useState(null);
  // HR Documents state
  const [hrSelectedEmpId, setHrSelectedEmpId] = useState(null);
  const [hrSubTypeFilter, setHrSubTypeFilter] = useState('');
  const [hrMonthFilter, setHrMonthFilter] = useState('');
  const [hrYearFilter, setHrYearFilter] = useState('');

  useEffect(() => {
    fetchFiles();
    fetchFolders();
    if (["HR", "ADMIN", "MANAGER"].includes(user?.role)) {
      fetchEmployees();
    }
    if (["HR", "ADMIN"].includes(user?.role)) {
      fetchDepartments();
    }
  }, [user?.role]);

  const fetchFiles = async () => {
    try {
      const response = await api.get("/api/files");
      console.log('All files fetched:', response.data);
      console.log('HR Document files:', response.data.filter(f => f.type === 'HR_DOCUMENT'));
      console.log('Current user ID:', user.id);
      setFiles(response.data);
      
      // Check if employee's documents are locked
      if (user?.role === 'EMPLOYEE') {
        const myDocs = response.data.filter(f => 
          f.type === 'EMPLOYEE' && 
          f.targetUserId === user.id && 
          f.uploadedBy._id === user.id
        );
        setIsLocked(myDocs.some(doc => doc.isLocked));
      }
    } catch (error) {
      console.error("Error fetching files:", error);
      toast.error("Error fetching files");
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await api.get("/api/employees");
      setEmployees(response.data);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await api.get("/api/departments?limit=100");
      setDepartments(response.data.data || []);
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("type", fileForm.type);
      formData.append("category", fileForm.category);
      formData.append("description", fileForm.description);
      formData.append("requiresAcknowledgment", fileForm.requiresAcknowledgment);
      if (fileForm.targetUserId) formData.append("targetUserId", fileForm.targetUserId);
      if (uploadFolderId) formData.append("folderId", uploadFolderId);
      formData.append("visibility", JSON.stringify(fileForm.visibility));
      if (fileForm.subType) formData.append("subType", fileForm.subType);
      if (fileForm.month) formData.append("month", fileForm.month);
      if (fileForm.year) formData.append("year", fileForm.year);

      await api.post("/api/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setShowModal(false);
      setFileForm({
        type: "ORGANIZATION",
        category: "",
        description: "",
        targetUserId: "",
        requiresAcknowledgment: false,
        visibility: { type: "ALL", departments: [], roles: [], employees: [] },
        subType: "",
        month: "",
        year: "",
      });
      setSelectedFile(null);
      setUploadFolderId(null);
      fetchFiles();
      if (uploadFolderId) {
        const res = await api.get(`/api/folders/${uploadFolderId}/files`);
        setActiveFolder(res.data);
        if (orgActiveFolder?.folder?._id === uploadFolderId) setOrgActiveFolder(res.data);
      }
      toast.success("File uploaded successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Error uploading file");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (fileId) => {
    const result = await Swal.fire({
      title: 'Delete File?',
      text: 'This action cannot be undone!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        await api.delete(`/api/files/${fileId}`);
        fetchFiles();
        toast.success("File deleted successfully");
      } catch (error) {
        toast.error(error.response?.data?.message || "Error deleting file");
      }
    }
  };

  const fetchFolders = async () => {
    try {
      const res = await api.get('/api/folders');
      setFolders(res.data);
    } catch (e) { console.error(e); }
  };

  const handleBulkDeleteOrg = async () => {
    const result = await Swal.fire({ title: `Delete ${orgSelected.length} files?`, text: 'This cannot be undone.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc3545', confirmButtonText: 'Delete All' });
    if (result.isConfirmed) {
      try {
        await api.post('/api/files/bulk-delete', { fileIds: orgSelected });
        setOrgSelected([]);
        fetchFiles();
        toast.success(`${orgSelected.length} files deleted`);
      } catch (e) { toast.error('Error deleting files'); }
    }
  };

  const openOrgFolder = async (folder) => {
    try {
      const res = await api.get(`/api/folders/${folder._id}/files`);
      setOrgActiveFolder(res.data);
    } catch (e) { toast.error('Error opening folder'); }
  };

  const openFolder = async (folder) => {
    try {
      const res = await api.get(`/api/folders/${folder._id}/files`);
      setActiveFolder(res.data);
      setActiveTab('folders');
    } catch (e) { toast.error('Error opening folder'); }
  };

  const handleCreateFolder = async () => {
    try {
      const payload = {
        ...folderForm,
        tags: folderForm.tags ? folderForm.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        maxFileSizeMB: folderForm.maxFileSizeMB ? Number(folderForm.maxFileSizeMB) : null,
        expiryDate: folderForm.expiryDate || null
      };
      if (editingFolder) {
        await api.put(`/api/folders/${editingFolder._id}`, payload);
        toast.success('Folder updated');
      } else {
        await api.post('/api/folders', payload);
        toast.success('Folder created');
      }
      setShowFolderModal(false);
      setFolderForm(defaultFolderForm);
      setEditingFolder(null);
      setFolderStep(1);
      fetchFolders();
    } catch (err) { toast.error(err.response?.data?.message || 'Error saving folder'); }
  };

  const openEditFolder = (folder, e) => {
    e.stopPropagation();
    setEditingFolder(folder);
    setFolderForm({
      name: folder.name,
      description: folder.description || '',
      accessType: folder.accessType,
      color: folder.color || '#f59e0b',
      icon: folder.icon || 'folder',
      visibility: {
        type: folder.visibility?.type || 'ALL',
        departments: (folder.visibility?.departments || []).map(x => typeof x === 'object' ? String(x._id ?? x) : String(x)),
        roles: folder.visibility?.roles || [],
        employees: (folder.visibility?.employees || []).map(x => typeof x === 'object' ? String(x._id ?? x) : String(x)),
      },
      expiryDate: folder.expiryDate ? folder.expiryDate.split('T')[0] : '',
      maxFileSizeMB: folder.maxFileSizeMB || '',
      allowedFileTypes: folder.allowedFileTypes || [],
      isPasswordProtected: folder.isPasswordProtected || false,
      folderPassword: '',
      tags: (folder.tags || []).join(', ')
    });
    setFolderStep(1);
    setShowFolderModal(true);
  };

  const handleFolderVisibilityToggle = (field, id) => {
    setFolderForm(prev => {
      const current = prev.visibility[field].map(x => (typeof x === 'object' ? String(x._id ?? x) : String(x)));
      const sid = String(id);
      const updated = current.includes(sid) ? current.filter(x => x !== sid) : [...current, sid];
      return { ...prev, visibility: { ...prev.visibility, [field]: updated } };
    });
  };

  const handleFileTypeToggle = (val) => {
    setFolderForm(prev => {
      const current = prev.allowedFileTypes;
      const updated = current.includes(val) ? current.filter(x => x !== val) : [...current, val];
      return { ...prev, allowedFileTypes: updated };
    });
  };

  const handleVerifyFolderPassword = async (folder) => {
    try {
      await api.post(`/api/folders/${folder._id}/verify-password`, { password: folderPasswordInput });
      setPasswordUnlocked(prev => ({ ...prev, [folder._id]: true }));
      setFolderPasswordInput('');
      openFolder(folder);
    } catch (e) { toast.error('Incorrect password'); }
  };

  const handleDeleteFolder = async (folderId) => {
    const result = await Swal.fire({ title: 'Delete Folder?', text: 'Files inside will be unlinked.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc3545', confirmButtonText: 'Delete' });
    if (result.isConfirmed) {
      try {
        await api.delete(`/api/folders/${folderId}`);
        if (activeFolder?.folder?._id === folderId) setActiveFolder(null);
        fetchFolders();
        toast.success('Folder deleted');
      } catch (e) { toast.error('Error deleting folder'); }
    }
  };

  const handleAssignToFolder = async (folderId) => {
    try {
      await api.put(`/api/folders/assign/${assignFile._id}`, { folderId });
      setShowAssignModal(false);
      setAssignFile(null);
      fetchFiles();
      if (activeFolder) openFolder(activeFolder.folder);
      toast.success('File assigned to folder');
    } catch (e) { toast.error('Error assigning file'); }
  };

  const handlePrint = () => {
    if (!previewUrl) return;
    const win = window.open(previewUrl, '_blank');
    if (win) { win.onload = () => { win.focus(); win.print(); }; }
  };

  const closePreview = () => { setShowPreviewModal(false); setPreviewUrl(null); setImgZoom(1); setIsFullscreen(false); };

  const handlePreview = async (file) => {
    setPreviewFile(file);
    setPreviewUrl(null);
    setImgZoom(1);
    setIsFullscreen(false);
    setShowPreviewModal(true);
    setPreviewLoading(true);
    try {
      const response = await api.get(`/api/files/download/${file._id}`);
      setPreviewUrl(response.data.downloadUrl);
    } catch (error) {
      toast.error("Error loading preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  const getFileIcon = (mimeType) => {
    if (!mimeType) return { icon: 'fa-file', color: '#64748b', bg: '#f1f5f9' };
    if (mimeType.startsWith('image/')) return { icon: 'fa-file-image', color: '#8b5cf6', bg: '#f5f3ff' };
    if (mimeType === 'application/pdf') return { icon: 'fa-file-pdf', color: '#ef4444', bg: '#fef2f2' };
    if (mimeType.includes('word')) return { icon: 'fa-file-word', color: '#3b82f6', bg: '#eff6ff' };
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return { icon: 'fa-file-excel', color: '#10b981', bg: '#ecfdf5' };
    return { icon: 'fa-file-alt', color: '#f59e0b', bg: '#fffbeb' };
  };

  const handleDownload = async (fileId, fileName) => {
    try {
      const response = await api.get(`/api/files/download/${fileId}`);
      const { downloadUrl } = response.data;

      // Create a temporary link and click it to download
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Error downloading file");
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleAcknowledge = async (file) => {
    setSelectedFileForAck(file);
    setShowAckModal(true);
  };

  const submitAcknowledgment = async () => {
    try {
      await api.post(`/api/files/${selectedFileForAck._id}/acknowledge`, {
        comments: ackComments,
      });
      setShowAckModal(false);
      setAckComments("");
      setSelectedFileForAck(null);
      fetchFiles();
      toast.success("Document acknowledged successfully");
    } catch (error) {
      toast.error("Error acknowledging document");
    }
  };

  const handleSubmitDocuments = async () => {
    const result = await Swal.fire({
      title: 'Submit Documents?',
      text: 'Once submitted, you cannot upload/edit/delete. Continue?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, submit!'
    });

    if (result.isConfirmed) {
      try {
        await api.post('/api/files/submit-my-documents');
        fetchFiles();
        toast.success('Documents submitted successfully');
      } catch (error) {
        toast.error(error.response?.data?.message || 'Error submitting documents');
      }
    }
  };

  const handleUnlockDocuments = async (employeeId) => {
    try {
      await api.put(`/api/files/unlock/${employeeId}`);
      fetchFiles();
      toast.success('Documents unlocked');
    } catch (error) {
      toast.error('Error unlocking documents');
    }
  };

  const handleSubmitForEmployee = async (employeeId) => {
    try {
      await api.put(`/api/files/lock/${employeeId}`);
      fetchFiles();
      toast.success('Documents locked');
    } catch (error) {
      toast.error('Error locking documents');
    }
  };

  const handleVisibilityChange = (field, value) => {
    setFileForm(prev => ({ ...prev, visibility: { ...prev.visibility, [field]: value } }));
  };

  const handleVisibilityMultiToggle = (field, id) => {
    setFileForm(prev => {
      const current = prev.visibility[field];
      const updated = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
      return { ...prev, visibility: { ...prev.visibility, [field]: updated } };
    });
  };

  const handleOpenUploadInFolder = (folder) => {
    setUploadFolderId(folder._id);
    setFileForm({
      type: 'ORGANIZATION',
      category: '',
      description: '',
      targetUserId: '',
      requiresAcknowledgment: false,
      visibility: folder.visibility || { type: 'ALL', departments: [], roles: [], employees: [] },
    });
    setShowModal(true);
  };

  const handleOpenModal = () => {
    setUploadFolderId(null);
    if (user?.role === 'EMPLOYEE') {
      setFileForm({ 
        type: 'EMPLOYEE', 
        category: '', 
        description: '', 
        targetUserId: user.id, 
        requiresAcknowledgment: false,
        visibility: { type: 'ALL', departments: [], roles: [], employees: [] },
        subType: '', month: '', year: ''
      });
    } else {
      setFileForm({
        type: 'ORGANIZATION',
        category: '',
        description: '',
        targetUserId: '',
        requiresAcknowledgment: false,
        visibility: { type: 'ALL', departments: [], roles: [], employees: [] },
        subType: '', month: '', year: new Date().getFullYear()
      });
    }
    setShowModal(true);
  };

  const getVisibilityBadge = (file) => {
    if (file.type === 'EMPLOYEE') return null;
    const v = file.visibility;
    if (!v || v.type === 'ALL') return <Badge bg="success"><i className="fas fa-globe me-1"></i>All</Badge>;
    if (v.type === 'DEPARTMENTS') return <Badge bg="info"><i className="fas fa-building me-1"></i>Departments ({v.departments?.length})</Badge>;
    if (v.type === 'ROLES') return <Badge bg="warning" text="dark"><i className="fas fa-user-tag me-1"></i>Roles ({v.roles?.length})</Badge>;
    if (v.type === 'SPECIFIC_EMPLOYEES') return <Badge bg="secondary"><i className="fas fa-users me-1"></i>Specific ({v.employees?.length})</Badge>;
    return null;
  };

  const getVerificationBadge = (status) => {
    const badges = {
      UNVERIFIED: <Badge bg="secondary"><i className="fas fa-question me-1"></i>Unverified</Badge>,
      VERIFIED: <Badge bg="success"><i className="fas fa-check-circle me-1"></i>Verified</Badge>,
      EXPIRED: <Badge bg="warning"><i className="fas fa-exclamation-triangle me-1"></i>Expired</Badge>,
      INVALID: <Badge bg="danger"><i className="fas fa-times-circle me-1"></i>Invalid</Badge>
    };
    return badges[status] || badges.UNVERIFIED;
  };

  const handleVerifyDocument = async (file) => {
    setSelectedFileForVerify(file);
    setVerifyForm({
      verificationStatus: file.verificationStatus || 'VERIFIED'
    });
    setShowVerifyModal(true);
  };

  const submitVerification = async () => {
    try {
      await api.put(`/api/files/${selectedFileForVerify._id}/verify`, verifyForm);
      setShowVerifyModal(false);
      setSelectedFileForVerify(null);
      setVerifyForm({ verificationStatus: 'VERIFIED' });
      fetchFiles();
      toast.success('Document verification updated');
    } catch (error) {
      toast.error('Error updating verification');
    }
  };

  const organizationFiles = files.filter(
    (file) => file.type === "ORGANIZATION"
  );
  const employeeFiles = files.filter((file) => file.type === "EMPLOYEE");
  const hrDocumentFiles = files.filter((file) => file.type === "HR_DOCUMENT");

  // For employees, filter HR documents by their user ID
  const myHrDocuments = user?.role === 'EMPLOYEE' 
    ? hrDocumentFiles.filter(f => {
        const targetId = typeof f.targetUserId === 'object' ? f.targetUserId._id : f.targetUserId;
        return String(targetId) === String(user.id);
      })
    : hrDocumentFiles;

  const HR_SUB_TYPES = [
    { value: 'SALARY_SLIP', label: 'Salary Slip', icon: 'fa-file-invoice-dollar', color: '#10b981', bg: '#ecfdf5' },
    { value: 'OFFER_LETTER', label: 'Offer Letter', icon: 'fa-file-signature', color: '#6366f1', bg: '#eef2ff' },
    { value: 'APPRAISAL_LETTER', label: 'Appraisal Letter', icon: 'fa-chart-line', color: '#f59e0b', bg: '#fffbeb' },
    { value: 'EXPERIENCE_LETTER', label: 'Experience Letter', icon: 'fa-award', color: '#8b5cf6', bg: '#f5f3ff' },
    { value: 'RELIEVING_LETTER', label: 'Relieving Letter', icon: 'fa-door-open', color: '#ef4444', bg: '#fef2f2' },
    { value: 'OTHER', label: 'Other', icon: 'fa-file-alt', color: '#64748b', bg: '#f1f5f9' },
  ];

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const getSubTypeInfo = (subType) => HR_SUB_TYPES.find(s => s.value === subType) || HR_SUB_TYPES[HR_SUB_TYPES.length - 1];

  // Filter files based on search term (for HR/Admin)
  const filterFiles = (fileList) => {
    if (!searchTerm || user?.role === 'EMPLOYEE') return fileList;
    
    const term = searchTerm.toLowerCase();
    return fileList.filter(file => {
      const uploaderName = `${file.uploadedBy?.firstName || ''} ${file.uploadedBy?.lastName || ''}`.toLowerCase();
      const targetEmployee = employees.find(emp => emp._id === file.targetUserId);
      const targetName = targetEmployee ? `${targetEmployee.firstName} ${targetEmployee.lastName}`.toLowerCase() : '';
      
      return uploaderName.includes(term) || targetName.includes(term) || file.name.toLowerCase().includes(term);
    });
  };

  const filteredOrgFiles = filterFiles(organizationFiles);
  const filteredEmpFiles = filterFiles(employeeFiles);

  if (loading) {
    return (
      <div
        className="d-flex justify-content-center align-items-center"
        style={{ height: "400px" }}
      >
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status"></div>
          <p className="text-muted">Loading files...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in-up">
      <div className="page-header d-flex align-items-center justify-content-between">
        <div>
          <h1 className="page-title mb-1">
            <i className="fas fa-folder-open me-3 text-primary"></i>
            Files & Documents
          </h1>
          <p className="text-muted mb-0">
            Manage organization and employee files
          </p>
        </div>
        <div className="d-flex gap-2 align-items-center">
          {user?.role === 'EMPLOYEE' && !isLocked && (
            <>
              <Button variant="primary" onClick={handleOpenModal}>
                <i className="fas fa-upload me-2"></i>Upload My Documents
              </Button>
              {employeeFiles.filter(f => f.uploadedBy._id === user.id).length > 0 && (
                <Button variant="success" onClick={handleSubmitDocuments}>
                  <i className="fas fa-lock me-2"></i>Submit Documents
                </Button>
              )}
            </>
          )}
          {user?.role === 'EMPLOYEE' && isLocked && (
            <div className="alert alert-info mb-0 py-2 px-3">
              <i className="fas fa-lock me-2"></i>
              Documents submitted. Contact HR to make changes.
            </div>
          )}
          {['HR', 'ADMIN'].includes(user?.role) && (
            <>
              <Button variant="outline-warning" onClick={() => { setEditingFolder(null); setFolderForm(defaultFolderForm); setFolderStep(1); setShowFolderModal(true); }}>
                <i className="fas fa-folder-plus me-2"></i>New Folder
              </Button>
              <Button variant="primary" onClick={handleOpenModal}>
                <i className="fas fa-upload me-2"></i>Upload Document
              </Button>
            </>
          )}
        </div>
      </div>

      <Nav variant="tabs" className="mb-4">
        {user?.role === 'EMPLOYEE' ? (
          // Employee tabs: Organization, My Documents, Folders, HR Documents
          <>
            <Nav.Item>
              <Nav.Link active={activeTab === "organization"} onClick={() => { setActiveTab("organization"); setActiveFolder(null); }} style={{ color: '#10b981', fontWeight: 600 }}>
                <i className="fas fa-building me-2"></i>
                Organization Documents ({organizationFiles.length})
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link active={activeTab === "employee"} onClick={() => { setActiveTab("employee"); setActiveFolder(null); }} style={{ color: '#10b981', fontWeight: 600 }}>
                <i className="fas fa-user me-2"></i>
                My Documents ({employeeFiles.filter(f => f.targetUserId === user.id).length})
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link active={activeTab === "folders"} onClick={() => { setActiveTab("folders"); setActiveFolder(null); }} style={{ color: '#10b981', fontWeight: 600 }}>
                <i className="fas fa-folder me-2"></i>
                Folders ({folders.length})
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link active={activeTab === "hr_documents"} onClick={() => setActiveTab("hr_documents")} style={{ color: '#10b981', fontWeight: 600 }}>
                <i className="fas fa-file-invoice-dollar me-2"></i>
                HR Documents ({user?.role === 'EMPLOYEE' ? myHrDocuments.length : hrDocumentFiles.length})
              </Nav.Link>
            </Nav.Item>
          </>
        ) : (
          // HR/Admin tabs: Organization, Employee, Folders, HR Documents
          <>
            <Nav.Item>
              <Nav.Link active={activeTab === "organization"} onClick={() => { setActiveTab("organization"); setActiveFolder(null); }} style={{ color: '#10b981', fontWeight: 600 }}>
                <i className="fas fa-building me-2"></i>
                Organization Documents ({organizationFiles.length})
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link active={activeTab === "employee"} onClick={() => { setActiveTab("employee"); setActiveFolder(null); }} style={{ color: '#10b981', fontWeight: 600 }}>
                <i className="fas fa-user me-2"></i>
                Employee Documents ({employeeFiles.length})
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link active={activeTab === "folders"} onClick={() => { setActiveTab("folders"); setActiveFolder(null); }} style={{ color: '#10b981', fontWeight: 600 }}>
                <i className="fas fa-folder me-2"></i>
                Folders ({folders.length})
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link active={activeTab === "hr_documents"} onClick={() => { setActiveTab("hr_documents"); setHrSelectedEmpId(null); }} style={{ color: '#10b981', fontWeight: 600 }}>
                <i className="fas fa-file-invoice-dollar me-2"></i>
                HR Documents ({hrDocumentFiles.length})
              </Nav.Link>
            </Nav.Item>
          </>
        )}
      </Nav>

      {/* HR Documents - Employee View */}
      {activeTab === 'hr_documents' && user?.role === 'EMPLOYEE' && (
        <Row>
          <Col>
            <Card className="modern-table-wrapper">
              <Card.Header><h5 className="mb-0"><i className="fas fa-file-invoice-dollar me-2"></i>HR Documents</h5></Card.Header>
              <Card.Body className="p-0">
                {myHrDocuments.length === 0 ? (
                  <div className="table-empty"><i className="fas fa-folder-open"></i><p className="mb-0">No HR documents available</p></div>
                ) : (
                  <div className="table-responsive">
                    <Table className="table">
                      <thead><tr><th>Document Type</th><th>Name</th><th>Month/Year</th><th>Size</th><th>Date</th><th>Actions</th></tr></thead>
                      <tbody>
                        {myHrDocuments.map(file => {
                          const subTypeInfo = getSubTypeInfo(file.subType);
                          return (
                            <tr key={file._id}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <div style={{ width: 32, height: 32, borderRadius: '0.4rem', background: subTypeInfo.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <i className={`fas ${subTypeInfo.icon}`} style={{ color: subTypeInfo.color, fontSize: '0.9rem' }}></i>
                                  </div>
                                  <span style={{ fontWeight: 600, color: subTypeInfo.color }}>{subTypeInfo.label}</span>
                                </div>
                              </td>
                              <td><div className="fw-semibold">{file.name}</div>{file.description && <small className="text-muted">{file.description}</small>}</td>
                              <td>
                                {file.month && file.year ? (
                                  <span className="text-muted">{MONTHS[file.month - 1]} {file.year}</span>
                                ) : (
                                  <span style={{ color: '#cbd5e1' }}>—</span>
                                )}
                              </td>
                              <td>{formatFileSize(file.size)}</td>
                              <td><span className="text-muted">{new Date(file.createdAt).toLocaleDateString()}</span></td>
                              <td>
                                <div className="d-flex gap-1 flex-wrap">
                                  <Button size="sm" variant="outline-secondary" onClick={() => handlePreview(file)}><i className="fas fa-eye me-1"></i>Preview</Button>
                                  <Button size="sm" variant="outline-primary" onClick={() => handleDownload(file._id, file.originalName || file.name)}><i className="fas fa-download me-1"></i>Download</Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {activeTab === 'employee' && ['HR', 'ADMIN'].includes(user?.role) && !selectedEmpId && (
        <Row>
          <Col>
            <Card className="modern-table-wrapper">
              <Card.Header>
                <div className="d-flex justify-content-between align-items-center">
                  <h5 className="mb-0"><i className="fas fa-users me-2"></i>Employee Documents</h5>
                  <Form.Control
                    type="text" placeholder="Search employee..."
                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    style={{ width: 240, fontSize: '0.85rem' }}
                  />
                </div>
              </Card.Header>
              <Card.Body>
                {(() => {
                  // Build unique employee list from files
                  const empMap = {};
                  employeeFiles.forEach(f => {
                    const tid = f.targetUserId;
                    if (!tid) return;
                    if (!empMap[tid]) empMap[tid] = { id: tid, files: [], locked: false };
                    empMap[tid].files.push(f);
                    if (f.isLocked) empMap[tid].locked = true;
                  });
                  // Also include employees who have no files yet
                  employees.forEach(emp => {
                    if (!empMap[emp._id]) empMap[emp._id] = { id: emp._id, files: [], locked: false };
                  });
                  const term = searchTerm.toLowerCase();
                  const empList = Object.values(empMap).filter(e => {
                    const emp = employees.find(x => x._id === e.id);
                    if (!emp) return false;
                    return !term || `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(term) || (emp.department || '').toLowerCase().includes(term);
                  });
                  if (empList.length === 0) return (
                    <div className="table-empty"><i className="fas fa-users"></i><p className="mb-0">No employees found</p></div>
                  );
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: '1rem' }}>
                      {empList.map(e => {
                        const emp = employees.find(x => x._id === e.id);
                        if (!emp) return null;
                        const initials = `${emp.firstName?.[0] || ''}${emp.lastName?.[0] || ''}`.toUpperCase();
                        const colors = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899'];
                        const color = colors[(emp.firstName?.charCodeAt(0) || 0) % colors.length];
                        const verified = e.files.filter(f => f.verificationStatus === 'VERIFIED').length;
                        const unverified = e.files.filter(f => f.verificationStatus === 'UNVERIFIED').length;
                        return (
                          <div key={e.id} onClick={() => setSelectedEmpId(e.id)}
                            style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '0.875rem', padding: '1.25rem 1rem', cursor: 'pointer', transition: 'box-shadow 0.15s, border-color 0.15s' }}
                            onMouseEnter={el => { el.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.12)'; el.currentTarget.style.borderColor = '#a5b4fc'; }}
                            onMouseLeave={el => { el.currentTarget.style.boxShadow = 'none'; el.currentTarget.style.borderColor = '#e2e8f0'; }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
                              <div style={{ width: 42, height: 42, borderRadius: '50%', background: color + '20', border: `2px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.95rem', color, flexShrink: 0 }}>
                                {initials}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.firstName} {emp.lastName}</div>
                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.department || emp.designation || 'No dept'}</div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '1rem', background: '#f1f5f9', color: '#475569' }}>
                                <i className="fas fa-file me-1"></i>{e.files.length} docs
                              </span>
                              {verified > 0 && <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '1rem', background: '#ecfdf5', color: '#10b981' }}>
                                <i className="fas fa-check-circle me-1"></i>{verified} verified
                              </span>}
                              {unverified > 0 && <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '1rem', background: '#fef3c7', color: '#d97706' }}>
                                <i className="fas fa-clock me-1"></i>{unverified} pending
                              </span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.1rem' }}>
                              <button
                                onClick={ev => {
                                  ev.stopPropagation();
                                  e.locked ? handleUnlockDocuments(e.id) : handleSubmitForEmployee(e.id);
                                }}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                                  padding: '0.3rem 0.65rem', borderRadius: '1rem', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700,
                                  background: e.locked ? '#eef2ff' : '#f1f5f9',
                                  color: e.locked ? '#6366f1' : '#64748b',
                                  transition: 'all 0.15s'
                                }}
                              >
                                <i className={`fas fa-${e.locked ? 'lock' : 'lock-open'}`}></i>
                                {e.locked ? 'Locked — Unlock' : 'Unlocked — Lock'}
                              </button>
                              <i className="fas fa-chevron-right" style={{ color: '#cbd5e1', fontSize: '0.75rem' }}></i>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {activeTab === 'employee' && ['HR', 'ADMIN'].includes(user?.role) && selectedEmpId && (() => {
        const emp = employees.find(x => x._id === selectedEmpId);
        const empFiles = filteredEmpFiles.filter(f => f.targetUserId === selectedEmpId);
        const initials = `${emp?.firstName?.[0] || ''}${emp?.lastName?.[0] || ''}`.toUpperCase();
        const colors = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899'];
        const color = colors[(emp?.firstName?.charCodeAt(0) || 0) % colors.length];
        return (
          <Row>
            <Col>
              <Card className="modern-table-wrapper">
                <Card.Header>
                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <div className="d-flex align-items-center gap-2">
                      <button onClick={() => setSelectedEmpId(null)} style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
                        <i className="fas fa-arrow-left me-1"></i>Back
                      </button>
                      <span style={{ color: '#cbd5e1' }}>|</span>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: color + '20', border: `2px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', color }}>{initials}</div>
                      <div>
                        <h5 className="mb-0" style={{ fontSize: '0.95rem' }}>{emp?.firstName} {emp?.lastName}</h5>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{emp?.department || emp?.designation || ''}</div>
                      </div>
                      {empFiles.some(f => f.isLocked) && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6366f1', background: '#eef2ff', padding: '0.2rem 0.55rem', borderRadius: '1rem' }}>
                          <i className="fas fa-lock me-1"></i>Submitted
                        </span>
                      )}
                    </div>
                    <div className="d-flex gap-2">
                      <button
                        onClick={() => empFiles.some(f => f.isLocked) ? handleUnlockDocuments(selectedEmpId) : handleSubmitForEmployee(selectedEmpId)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.4rem',
                          padding: '0.4rem 0.9rem', borderRadius: '0.5rem', border: `1.5px solid ${empFiles.some(f => f.isLocked) ? '#a5b4fc' : '#d1d5db'}`,
                          background: empFiles.some(f => f.isLocked) ? '#eef2ff' : '#f9fafb',
                          color: empFiles.some(f => f.isLocked) ? '#6366f1' : '#6b7280',
                          fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer'
                        }}
                      >
                        <i className={`fas fa-${empFiles.some(f => f.isLocked) ? 'lock-open' : 'lock'}`}></i>
                        {empFiles.some(f => f.isLocked) ? 'Unlock Documents' : 'Lock Documents'}
                      </button>
                      <Button size="sm" variant="primary" onClick={() => { setFileForm({ type: 'EMPLOYEE', category: '', description: '', targetUserId: selectedEmpId, requiresAcknowledgment: false, visibility: { type: 'ALL', departments: [], roles: [], employees: [] } }); setUploadFolderId(null); setShowModal(true); }}>
                        <i className="fas fa-upload me-1"></i>Upload for {emp?.firstName}
                      </Button>
                    </div>
                  </div>
                </Card.Header>
                <Card.Body className="p-0">
                  {empFiles.length === 0 ? (
                    <div className="table-empty"><i className="fas fa-folder-open"></i><p className="mb-0">No documents for this employee</p></div>
                  ) : (
                    <div className="table-responsive">
                      <Table className="table">
                        <thead>
                          <tr><th>Name</th><th>Category</th><th>Size</th><th>Date</th><th>Verification</th><th>Actions</th></tr>
                        </thead>
                        <tbody>
                          {empFiles.map(file => (
                            <tr key={file._id}>
                              <td>
                                <div className="fw-semibold"><i className="fas fa-file me-2 text-primary"></i>{file.name}</div>
                                {file.description && <small className="text-muted">{file.description}</small>}
                              </td>
                              <td><span className="text-muted">{file.category || 'N/A'}</span></td>
                              <td>{formatFileSize(file.size)}</td>
                              <td><span className="text-muted">{new Date(file.createdAt).toLocaleDateString()}</span></td>
                              <td>
                                {getVerificationBadge(file.verificationStatus)}
                                {file.verifiedBy && <div className="mt-1"><small className="text-muted"><i className="fas fa-user-check me-1"></i>{file.verifiedBy.firstName} {file.verifiedBy.lastName}</small></div>}
                              </td>
                              <td>
                                <div className="d-flex gap-1 flex-wrap">
                                  <Button size="sm" variant="outline-secondary" onClick={() => handlePreview(file)}><i className="fas fa-eye me-1"></i>Preview</Button>
                                  <Button size="sm" variant="outline-primary" onClick={() => handleDownload(file._id, file.originalName || file.name)}><i className="fas fa-download me-1"></i>Download</Button>
                                  <Button size="sm" variant="outline-success" onClick={() => handleVerifyDocument(file)}><i className="fas fa-check-circle me-1"></i>Verify</Button>
                                  <Button size="sm" variant="outline-danger" onClick={() => handleDeleteFile(file._id)}><i className="fas fa-trash me-1"></i>Delete</Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        );
      })()}

      {activeTab === 'employee' && user?.role === 'EMPLOYEE' && (
        <Row>
          <Col>
            <Card className="modern-table-wrapper">
              <Card.Header><h5 className="mb-0"><i className="fas fa-user me-2"></i>My Documents</h5></Card.Header>
              <Card.Body className="p-0">
                {employeeFiles.filter(f => f.targetUserId === user.id).length === 0 ? (
                  <div className="table-empty"><i className="fas fa-folder-open"></i><p className="mb-0">No documents uploaded yet</p></div>
                ) : (
                  <div className="table-responsive">
                    <Table className="table">
                      <thead><tr><th>Name</th><th>Category</th><th>Size</th><th>Date</th><th>Verification</th><th>Actions</th></tr></thead>
                      <tbody>
                        {employeeFiles.filter(f => f.targetUserId === user.id).map(file => (
                          <tr key={file._id}>
                            <td><div className="fw-semibold"><i className="fas fa-file me-2 text-primary"></i>{file.name}</div>{file.description && <small className="text-muted">{file.description}</small>}</td>
                            <td><span className="text-muted">{file.category || 'N/A'}</span></td>
                            <td>{formatFileSize(file.size)}</td>
                            <td><span className="text-muted">{new Date(file.createdAt).toLocaleDateString()}</span></td>
                            <td>{getVerificationBadge(file.verificationStatus)}</td>
                            <td>
                              <div className="d-flex gap-1 flex-wrap">
                                <Button size="sm" variant="outline-secondary" onClick={() => handlePreview(file)}><i className="fas fa-eye me-1"></i>Preview</Button>
                                <Button size="sm" variant="outline-primary" onClick={() => handleDownload(file._id, file.originalName || file.name)}><i className="fas fa-download me-1"></i>Download</Button>
                                {!file.isLocked && file.uploadedBy._id === user.id && (
                                  <Button size="sm" variant="outline-danger" onClick={() => handleDeleteFile(file._id)}><i className="fas fa-trash me-1"></i>Delete</Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {activeTab === 'organization' && (
        <Row>
          <Col>
            <Card className="modern-table-wrapper">
              <Card.Header>
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <h5 className="mb-0"><i className="fas fa-building me-2"></i>Organization Documents</h5>
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    {/* Search */}
                    <Form.Control type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: 180, fontSize: '0.82rem' }} />
                    {/* Folder filter */}
                    {['HR','ADMIN'].includes(user?.role) && (
                      <Form.Select value={orgFolderFilter} onChange={e => setOrgFolderFilter(e.target.value)} style={{ width: 150, fontSize: '0.82rem' }}>
                        <option value="">All Folders</option>
                        <option value="none">No Folder</option>
                        {folders.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
                      </Form.Select>
                    )}
                    {/* Category filter */}
                    <Form.Select value={orgCategoryFilter} onChange={e => setOrgCategoryFilter(e.target.value)} style={{ width: 140, fontSize: '0.82rem' }}>
                      <option value="">All Categories</option>
                      {['Policy','Handbook','Form','Contract','Offer Letter','ID Proof','Certificate','Other'].map(c => <option key={c} value={c}>{c}</option>)}
                    </Form.Select>
                    {/* Visibility filter */}
                    {['HR','ADMIN'].includes(user?.role) && (
                      <Form.Select value={orgVisibilityFilter} onChange={e => setOrgVisibilityFilter(e.target.value)} style={{ width: 140, fontSize: '0.82rem' }}>
                        <option value="">All Visibility</option>
                        <option value="ALL">Everyone</option>
                        <option value="DEPARTMENTS">Departments</option>
                        <option value="ROLES">By Role</option>
                        <option value="SPECIFIC_EMPLOYEES">Specific</option>
                      </Form.Select>
                    )}
                    {/* Sort */}
                    <Form.Select value={orgSort} onChange={e => setOrgSort(e.target.value)} style={{ width: 140, fontSize: '0.82rem' }}>
                      <option value="date_desc">Newest First</option>
                      <option value="date_asc">Oldest First</option>
                      <option value="name_asc">Name A–Z</option>
                      <option value="name_desc">Name Z–A</option>
                      <option value="size_desc">Largest First</option>
                    </Form.Select>
                    {/* View toggle */}
                    <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '0.4rem', padding: '0.2rem', gap: '0.15rem' }}>
                      {['table','grid'].map(v => (
                        <button key={v} onClick={() => setOrgView(v)}
                          style={{ padding: '0.3rem 0.55rem', borderRadius: '0.3rem', border: 'none', cursor: 'pointer', fontSize: '0.8rem',
                            background: orgView === v ? '#fff' : 'transparent', color: orgView === v ? '#6366f1' : '#94a3b8',
                            boxShadow: orgView === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                          <i className={`fas fa-${v === 'table' ? 'list' : 'th-large'}`}></i>
                        </button>
                      ))}
                    </div>
                    {/* New Folder shortcut */}
                    {['HR','ADMIN'].includes(user?.role) && (
                      <button onClick={() => { setEditingFolder(null); setFolderForm(defaultFolderForm); setFolderStep(1); setShowFolderModal(true); }}
                        style={{ padding: '0.35rem 0.8rem', borderRadius: '0.4rem', border: '1.5px solid #fde68a', background: '#fffbeb', color: '#d97706', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <i className="fas fa-folder-plus me-1"></i>New Folder
                      </button>
                    )}
                    {/* Bulk delete */}
                    {['HR','ADMIN'].includes(user?.role) && orgSelected.length > 0 && (
                      <button onClick={handleBulkDeleteOrg}
                        style={{ padding: '0.35rem 0.8rem', borderRadius: '0.4rem', border: '1.5px solid #fecaca', background: '#fef2f2', color: '#ef4444', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                        <i className="fas fa-trash me-1"></i>Delete ({orgSelected.length})
                      </button>
                    )}
                  </div>
                </div>
              </Card.Header>
              <Card.Body className={orgView === 'grid' ? 'p-3' : 'p-0'}>
                {(() => {
                  let docs = filteredOrgFiles;
                  if (orgCategoryFilter) docs = docs.filter(f => f.category === orgCategoryFilter);
                  if (orgVisibilityFilter) docs = docs.filter(f => f.visibility?.type === orgVisibilityFilter);
                  if (orgFolderFilter === 'none') docs = docs.filter(f => !f.folderId);
                  else if (orgFolderFilter) docs = docs.filter(f => String(f.folderId) === orgFolderFilter);
                  docs = [...docs].sort((a, b) => {
                    if (orgSort === 'date_desc') return new Date(b.createdAt) - new Date(a.createdAt);
                    if (orgSort === 'date_asc') return new Date(a.createdAt) - new Date(b.createdAt);
                    if (orgSort === 'name_asc') return a.name.localeCompare(b.name);
                    if (orgSort === 'name_desc') return b.name.localeCompare(a.name);
                    if (orgSort === 'size_desc') return (b.size || 0) - (a.size || 0);
                    return 0;
                  });
                  if (docs.length === 0) return (
                    <div className="table-empty"><i className="fas fa-folder-open"></i><p className="mb-0">No organization documents found</p></div>
                  );

                  // ── Grid view ──
                  if (orgView === 'grid') return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: '1rem' }}>
                      {docs.map(file => {
                        const fi = getFileIcon(file.mimeType);
                        const isExpiring = file.expiryDate && new Date(file.expiryDate) > new Date() && (new Date(file.expiryDate) - new Date()) < 7 * 86400000;
                        const isExpired = file.expiryDate && new Date(file.expiryDate) < new Date();
                        return (
                          <div key={file._id} style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '0.875rem', padding: '1rem', position: 'relative' }}>
                            {['HR','ADMIN'].includes(user?.role) && (
                              <input type="checkbox" checked={orgSelected.includes(file._id)}
                                onChange={e => { e.stopPropagation(); setOrgSelected(prev => e.target.checked ? [...prev, file._id] : prev.filter(x => x !== file._id)); }}
                                style={{ position: 'absolute', top: '0.75rem', left: '0.75rem', width: 15, height: 15, cursor: 'pointer' }} />
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.65rem', paddingLeft: ['HR','ADMIN'].includes(user?.role) ? '1.25rem' : 0 }}>
                              <div style={{ width: 38, height: 38, borderRadius: '0.5rem', background: fi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <i className={`fas ${fi.icon}`} style={{ color: fi.color, fontSize: '1rem' }}></i>
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{file.category || 'No category'} · {formatFileSize(file.size)}</div>
                              </div>
                            </div>
                            {/* Badges */}
                            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                              {getVisibilityBadge(file)}
                              {isExpired && <Badge bg="danger"><i className="fas fa-clock me-1"></i>Expired</Badge>}
                              {isExpiring && !isExpired && <Badge bg="warning"><i className="fas fa-exclamation-triangle me-1"></i>Expiring soon</Badge>}
                              {file.requiresAcknowledgment && <Badge bg="info"><i className="fas fa-signature me-1"></i>Ack required</Badge>}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.65rem' }}>
                              <i className="fas fa-user me-1"></i>{file.uploadedBy?.firstName} {file.uploadedBy?.lastName} · {new Date(file.createdAt).toLocaleDateString()}
                              {file.folderId && (() => { const f = folders.find(x => x._id === String(file.folderId) || String(x._id) === String(file.folderId)); return f ? <span style={{ marginLeft: '0.4rem', background: f.color + '20', color: f.color, padding: '0.1rem 0.4rem', borderRadius: '1rem', fontWeight: 600 }}><i className="fas fa-folder me-1"></i>{f.name}</span> : null; })()}
                            </div>
                            <div style={{ display: 'flex', gap: '0.3rem' }}>
                              <button onClick={() => handlePreview(file)} style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.35rem', padding: '0.35rem', fontSize: '0.75rem', fontWeight: 600, color: '#475569', cursor: 'pointer' }}><i className="fas fa-eye me-1"></i>Preview</button>
                              <button onClick={() => handleDownload(file._id, file.originalName || file.name)} style={{ flex: 1, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '0.35rem', padding: '0.35rem', fontSize: '0.75rem', fontWeight: 600, color: '#3b82f6', cursor: 'pointer' }}><i className="fas fa-download me-1"></i>Download</button>
                              {['HR','ADMIN'].includes(user?.role) && (
                                <button onClick={() => { setAssignFile(file); setShowAssignModal(true); }} style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '0.35rem', padding: '0.35rem 0.5rem', fontSize: '0.75rem', color: '#7c3aed', cursor: 'pointer' }} title="Move to folder"><i className="fas fa-folder-open"></i></button>
                              )}
                              {['HR','ADMIN'].includes(user?.role) && <button onClick={() => handleDeleteFile(file._id)} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.35rem', padding: '0.35rem 0.5rem', fontSize: '0.75rem', color: '#ef4444', cursor: 'pointer' }}><i className="fas fa-trash"></i></button>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );

                  // ── Table view ──
                  const thStyle = { padding: '0.65rem 0.85rem', fontWeight: 600, color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', background: '#f8fafc', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' };
                  return (
                    <div className="table-responsive" style={{ borderRadius: '0 0 0.75rem 0.75rem', overflow: 'hidden' }}>
                      <Table className="table mb-0" style={{ fontSize: '0.85rem' }}>
                        <thead>
                          <tr>
                            {['HR','ADMIN'].includes(user?.role) && (
                              <th style={{ ...thStyle, width: 40 }}>
                                <input type="checkbox"
                                  checked={orgSelected.length === docs.length && docs.length > 0}
                                  onChange={e => setOrgSelected(e.target.checked ? docs.map(f => f._id) : [])}
                                  style={{ width: 15, height: 15, cursor: 'pointer' }} />
                              </th>
                            )}
                            <th style={{ ...thStyle, minWidth: 220 }}>Name</th>
                            <th style={thStyle}>Category</th>
                            <th style={thStyle}>Folder</th>
                            <th style={thStyle}>Size</th>
                            {['HR','ADMIN'].includes(user?.role) && <th style={thStyle}>Uploaded By</th>}
                            {['HR','ADMIN'].includes(user?.role) && <th style={thStyle}>Visibility</th>}
                            <th style={thStyle}>Status</th>
                            <th style={thStyle}>Date</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {docs.map((file, idx) => {
                            const fi = getFileIcon(file.mimeType);
                            const isExpiring = file.expiryDate && new Date(file.expiryDate) > new Date() && (new Date(file.expiryDate) - new Date()) < 7 * 86400000;
                            const isExpired = file.expiryDate && new Date(file.expiryDate) < new Date();
                            const folderObj = file.folderId ? folders.find(x => String(x._id) === String(file.folderId)) : null;
                            const rowBg = isExpired ? '#fff5f5' : isExpiring ? '#fffbeb' : idx % 2 === 0 ? '#fff' : '#fafbfc';
                            return (
                              <tr key={file._id}
                                style={{ background: rowBg, borderBottom: '1px solid #f1f5f9', transition: 'background 0.12s' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#f0f4ff'}
                                onMouseLeave={e => e.currentTarget.style.background = rowBg}
                              >
                                {['HR','ADMIN'].includes(user?.role) && (
                                  <td style={{ padding: '0.7rem 0.85rem', verticalAlign: 'middle' }}>
                                    <input type="checkbox" checked={orgSelected.includes(file._id)}
                                      onChange={e => setOrgSelected(prev => e.target.checked ? [...prev, file._id] : prev.filter(x => x !== file._id))}
                                      style={{ width: 15, height: 15, cursor: 'pointer' }} />
                                  </td>
                                )}
                                {/* Name */}
                                <td style={{ padding: '0.7rem 0.85rem', verticalAlign: 'middle', maxWidth: 260 }}>
                                  <div className="d-flex align-items-center gap-2">
                                    <div style={{ width: 34, height: 34, borderRadius: '0.45rem', background: fi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                      <i className={`fas ${fi.icon}`} style={{ color: fi.color, fontSize: '0.9rem' }}></i>
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                      <div title={file.description || file.name} className="fw-semibold" style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200, color: '#1e293b' }}>{file.name}</div>
                                      {file.description && <div style={{ fontSize: '0.72rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{file.description}</div>}
                                    </div>
                                  </div>
                                </td>
                                {/* Category */}
                                <td style={{ padding: '0.7rem 0.85rem', verticalAlign: 'middle' }}>
                                  {file.category
                                    ? <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.55rem', borderRadius: '1rem', background: '#f1f5f9', color: '#475569' }}>{file.category}</span>
                                    : <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>—</span>}
                                </td>
                                {/* Folder */}
                                <td style={{ padding: '0.7rem 0.85rem', verticalAlign: 'middle' }}>
                                  {folderObj
                                    ? <span onClick={() => { setAssignFile(file); setShowAssignModal(true); }} title="Change folder" style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.55rem', borderRadius: '1rem', background: folderObj.color + '18', color: folderObj.color, cursor: ['HR','ADMIN'].includes(user?.role) ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                        <i className="fas fa-folder" style={{ fontSize: '0.7rem' }}></i>{folderObj.name}
                                      </span>
                                    : <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>—</span>}
                                </td>
                                {/* Size */}
                                <td style={{ padding: '0.7rem 0.85rem', verticalAlign: 'middle', color: '#64748b', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{formatFileSize(file.size)}</td>
                                {/* Uploaded By */}
                                {['HR','ADMIN'].includes(user?.role) && (
                                  <td style={{ padding: '0.7rem 0.85rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: '#6366f1', flexShrink: 0 }}>
                                        {(file.uploadedBy?.firstName?.[0] || '') + (file.uploadedBy?.lastName?.[0] || '')}
                                      </div>
                                      <span style={{ fontSize: '0.82rem', color: '#374151' }}>{file.uploadedBy?.firstName} {file.uploadedBy?.lastName}</span>
                                    </div>
                                  </td>
                                )}
                                {/* Visibility */}
                                {['HR','ADMIN'].includes(user?.role) && (
                                  <td style={{ padding: '0.7rem 0.85rem', verticalAlign: 'middle' }}>{getVisibilityBadge(file)}</td>
                                )}
                                {/* Status */}
                                <td style={{ padding: '0.7rem 0.85rem', verticalAlign: 'middle' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    {isExpired && <Badge bg="danger" style={{ fontSize: '0.65rem' }}><i className="fas fa-clock me-1"></i>Expired</Badge>}
                                    {isExpiring && !isExpired && <Badge bg="warning" style={{ fontSize: '0.65rem' }}><i className="fas fa-exclamation-triangle me-1"></i>Expiring</Badge>}
                                    {file.requiresAcknowledgment && <Badge bg="info" style={{ fontSize: '0.65rem' }}><i className="fas fa-signature me-1"></i>Ack req.</Badge>}
                                    {!isExpired && !isExpiring && !file.requiresAcknowledgment && <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>—</span>}
                                  </div>
                                </td>
                                {/* Date */}
                                <td style={{ padding: '0.7rem 0.85rem', verticalAlign: 'middle', color: '#64748b', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                                  {new Date(file.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </td>
                                {/* Actions */}
                                <td style={{ padding: '0.7rem 0.85rem', verticalAlign: 'middle', textAlign: 'right' }}>
                                  <div className="d-flex gap-1 justify-content-end">
                                    <button onClick={() => handlePreview(file)} title="Preview"
                                      style={{ width: 30, height: 30, borderRadius: '0.4rem', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <i className="fas fa-eye"></i>
                                    </button>
                                    <button onClick={() => handleDownload(file._id, file.originalName || file.name)} title="Download"
                                      style={{ width: 30, height: 30, borderRadius: '0.4rem', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#3b82f6', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <i className="fas fa-download"></i>
                                    </button>
                                    {['HR','ADMIN'].includes(user?.role) && (
                                      <button onClick={() => { setAssignFile(file); setShowAssignModal(true); }} title="Move to folder"
                                        style={{ width: 30, height: 30, borderRadius: '0.4rem', border: '1px solid #ddd6fe', background: '#f5f3ff', color: '#7c3aed', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <i className="fas fa-folder-open"></i>
                                      </button>
                                    )}
                                    {['HR','ADMIN'].includes(user?.role) && (
                                      <button onClick={() => handleDeleteFile(file._id)} title="Delete"
                                        style={{ width: 30, height: 30, borderRadius: '0.4rem', border: '1px solid #fecaca', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <i className="fas fa-trash"></i>
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </Table>
                    </div>
                  );
                })()}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
      {activeTab === 'folders' && !activeFolder && (
        <Row>
          <Col>
            <Card className="modern-table-wrapper">
              <Card.Header>
                <h5 className="mb-0"><i className="fas fa-folder me-2 text-warning"></i>Folders</h5>
              </Card.Header>
              <Card.Body>
                {folders.length === 0 ? (
                  <div className="table-empty">
                    <i className="fas fa-folder-open"></i>
                    <p className="mb-0">No folders yet{['HR','ADMIN'].includes(user?.role) ? ' — click New Folder to create one' : ''}</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '1rem' }}>
                    {folders.map(folder => (
                      <div key={folder._id} onClick={() => {
                          if (folder.isPasswordProtected && !passwordUnlocked[folder._id]) {
                            Swal.fire({
                              title: `🔒 ${folder.name}`,
                              html: `<input id="swal-pwd" type="password" class="swal2-input" placeholder="Enter folder password">`,
                              confirmButtonText: 'Unlock',
                              showCancelButton: true,
                              preConfirm: () => document.getElementById('swal-pwd').value
                            }).then(async result => {
                              if (result.isConfirmed) {
                                try {
                                  await api.post(`/api/folders/${folder._id}/verify-password`, { password: result.value });
                                  setPasswordUnlocked(prev => ({ ...prev, [folder._id]: true }));
                                  openFolder(folder);
                                } catch (e) { toast.error('Incorrect password'); }
                              }
                            });
                            return;
                          }
                          openFolder(folder);
                        }}
                        style={{ background: folder.color + '12', border: `1.5px solid ${folder.color}40`, borderRadius: '0.875rem', padding: '1.25rem 1rem', cursor: 'pointer', position: 'relative', transition: 'box-shadow 0.18s' }}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = `0 4px 16px ${folder.color}30`}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                      >
                        {/* Top badges */}
                        <div style={{ position: 'absolute', top: '0.6rem', right: '0.6rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {folder.isPasswordProtected && !passwordUnlocked[folder._id] && (
                            <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '0.15rem 0.4rem', borderRadius: '1rem', background: '#fef3c7', color: '#d97706' }}>
                              <i className="fas fa-lock me-1"></i>Protected
                            </span>
                          )}
                          {folder.expiryDate && (
                            <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '0.15rem 0.4rem', borderRadius: '1rem', background: new Date(folder.expiryDate) < new Date() ? '#fef2f2' : '#f0fdf4', color: new Date(folder.expiryDate) < new Date() ? '#ef4444' : '#16a34a' }}>
                              <i className="fas fa-clock me-1"></i>{new Date(folder.expiryDate) < new Date() ? 'Expired' : new Date(folder.expiryDate).toLocaleDateString()}
                            </span>
                          )}
                          <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '0.15rem 0.4rem', borderRadius: '1rem', background: folder.accessType === 'VIEW_PRINT' ? '#fef2f2' : '#ecfdf5', color: folder.accessType === 'VIEW_PRINT' ? '#ef4444' : '#10b981' }}>
                            <i className={`fas fa-${folder.accessType === 'VIEW_PRINT' ? 'eye' : 'unlock'} me-1`}></i>
                            {folder.accessType === 'VIEW_PRINT' ? 'View & Print' : 'Full'}
                          </span>
                        </div>

                        {/* Icon */}
                        <div style={{ width: 48, height: 48, borderRadius: '0.75rem', background: folder.color + '25', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
                          <i className={`fas fa-${folder.icon || 'folder'}`} style={{ fontSize: '1.5rem', color: folder.color }}></i>
                        </div>

                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b', paddingRight: '0.5rem', marginBottom: '0.2rem' }}>{folder.name}</div>
                        {folder.description && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.4rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.description}</div>}

                        {/* Tags */}
                        {folder.tags?.length > 0 && (
                          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                            {folder.tags.slice(0, 3).map(tag => (
                              <span key={tag} style={{ fontSize: '0.62rem', padding: '0.1rem 0.4rem', borderRadius: '1rem', background: folder.color + '20', color: folder.color, fontWeight: 600 }}>{tag}</span>
                            ))}
                          </div>
                        )}

                        {/* Footer row */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            <i className="fas fa-file me-1"></i>{folder.fileCount || 0} files
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                            {folder.createdBy?.firstName} {folder.createdBy?.lastName}
                          </div>
                        </div>

                        {/* HR/ADMIN actions */}
                        {['HR','ADMIN'].includes(user?.role) && (
                          <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.65rem', borderTop: `1px solid ${folder.color}25`, paddingTop: '0.6rem' }}>
                            <button onClick={e => openEditFolder(folder, e)}
                              style={{ flex: 1, background: folder.color + '15', border: `1px solid ${folder.color}40`, borderRadius: '0.35rem', padding: '0.3rem', fontSize: '0.72rem', fontWeight: 600, color: folder.color, cursor: 'pointer' }}>
                              <i className="fas fa-edit me-1"></i>Edit
                            </button>
                            <button onClick={e => { e.stopPropagation(); handleDeleteFolder(folder._id); }}
                              style={{ flex: 1, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.35rem', padding: '0.3rem', fontSize: '0.72rem', fontWeight: 600, color: '#ef4444', cursor: 'pointer' }}>
                              <i className="fas fa-trash me-1"></i>Delete
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Folder detail */}
      {activeTab === 'folders' && activeFolder && (
        <Row>
          <Col>
            <Card className="modern-table-wrapper">
              <Card.Header>
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <div className="d-flex align-items-center gap-2">
                    <button onClick={() => setActiveFolder(null)} style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
                      <i className="fas fa-arrow-left me-1"></i>Back
                    </button>
                    <span style={{ color: '#cbd5e1' }}>|</span>
                    <i className="fas fa-folder text-warning me-1"></i>
                    <h5 className="mb-0">{activeFolder.folder.name}</h5>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: '1rem', background: activeFolder.folder.accessType === 'VIEW_PRINT' ? '#fef2f2' : '#ecfdf5', color: activeFolder.folder.accessType === 'VIEW_PRINT' ? '#ef4444' : '#10b981' }}>
                      <i className={`fas fa-${activeFolder.folder.accessType === 'VIEW_PRINT' ? 'eye' : 'unlock'} me-1`}></i>
                      {activeFolder.folder.accessType === 'VIEW_PRINT' ? 'View & Print Only' : 'Full Access'}
                    </span>
                  </div>
                  {['HR', 'ADMIN'].includes(user?.role) && (
                    <Button size="sm" variant="primary" onClick={() => handleOpenUploadInFolder(activeFolder.folder)}>
                      <i className="fas fa-upload me-2"></i>Upload to Folder
                    </Button>
                  )}
                </div>
              </Card.Header>
              <Card.Body className="p-0">
                {activeFolder.files.length === 0 ? (
                  <div className="table-empty"><i className="fas fa-folder-open"></i><p className="mb-0">No files in this folder</p></div>
                ) : (
                  <>
                    <div className="table-responsive d-none d-md-block">
                      <Table className="table">
                        <thead><tr><th>Name</th><th>Category</th><th>Size</th><th>Uploaded By</th><th>Date</th><th>Actions</th></tr></thead>
                        <tbody>
                          {activeFolder.files.map(file => {
                            const isViewPrint = activeFolder.folder.accessType === 'VIEW_PRINT' && !['HR','ADMIN'].includes(user?.role);
                            const fi = getFileIcon(file.mimeType);
                            return (
                              <tr key={file._id}>
                                <td>
                                  <div className="fw-semibold d-flex align-items-center gap-2">
                                    <div style={{ width: 28, height: 28, borderRadius: '0.35rem', background: fi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                      <i className={`fas ${fi.icon}`} style={{ color: fi.color, fontSize: '0.8rem' }}></i>
                                    </div>
                                    {file.name}
                                  </div>
                                  {file.description && <small className="text-muted">{file.description}</small>}
                                </td>
                                <td><span className="text-muted">{file.category || 'N/A'}</span></td>
                                <td>{formatFileSize(file.size)}</td>
                                <td>{file.uploadedBy?.firstName} {file.uploadedBy?.lastName}</td>
                                <td>{new Date(file.createdAt).toLocaleDateString()}</td>
                                <td>
                                  <div className="d-flex gap-1 flex-wrap">
                                    <Button size="sm" variant="outline-secondary" onClick={() => handlePreview(file)}><i className="fas fa-eye me-1"></i>Preview</Button>
                                    {!isViewPrint && <Button size="sm" variant="outline-primary" onClick={() => handleDownload(file._id, file.originalName || file.name)}><i className="fas fa-download me-1"></i>Download</Button>}
                                    {['HR','ADMIN'].includes(user?.role) && <Button size="sm" variant="outline-danger" onClick={() => handleDeleteFile(file._id)}><i className="fas fa-trash me-1"></i>Delete</Button>}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </Table>
                    </div>
                    <div className="d-md-none">
                      {activeFolder.files.map(file => {
                        const isViewPrint = activeFolder.folder.accessType === 'VIEW_PRINT' && !['HR','ADMIN'].includes(user?.role);
                        const fi = getFileIcon(file.mimeType);
                        return (
                          <div key={file._id} style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                              <div style={{ width: 40, height: 40, borderRadius: '0.5rem', background: fi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <i className={`fas ${fi.icon}`} style={{ color: fi.color, fontSize: '1.1rem' }}></i>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <span>{formatFileSize(file.size)}</span>
                                  <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.65rem' }}>
                              <button onClick={() => handlePreview(file)} style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.4rem', padding: '0.45rem', fontSize: '0.78rem', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                                <i className="fas fa-eye me-1"></i>Preview
                              </button>
                              {!isViewPrint && (
                                <button onClick={() => handleDownload(file._id, file.originalName || file.name)} style={{ flex: 1, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '0.4rem', padding: '0.45rem', fontSize: '0.78rem', fontWeight: 600, color: '#3b82f6', cursor: 'pointer' }}>
                                  <i className="fas fa-download me-1"></i>Download
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* HR Documents Tab - For HR/ADMIN */}
      {activeTab === 'hr_documents' && ['HR', 'ADMIN'].includes(user?.role) && !hrSelectedEmpId && (
        <Row>
          <Col>
            <Card className="modern-table-wrapper">
              <Card.Header>
                <div className="d-flex justify-content-between align-items-center">
                  <h5 className="mb-0"><i className="fas fa-file-invoice-dollar me-2"></i>HR Documents by Employee</h5>
                  <Form.Control
                    type="text" placeholder="Search employee..."
                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    style={{ width: 240, fontSize: '0.85rem' }}
                  />
                </div>
              </Card.Header>
              <Card.Body>
                {(() => {
                  // Build employee map from HR documents
                  const empMap = {};
                  hrDocumentFiles.forEach(f => {
                    const tid = f.targetUserId;
                    if (!tid) return;
                    if (!empMap[tid]) empMap[tid] = { id: tid, files: [] };
                    empMap[tid].files.push(f);
                  });
                  
                  // Include all employees
                  employees.forEach(emp => {
                    if (!empMap[emp._id]) empMap[emp._id] = { id: emp._id, files: [] };
                  });
                  
                  const term = searchTerm.toLowerCase();
                  const empList = Object.values(empMap).filter(e => {
                    const emp = employees.find(x => x._id === e.id);
                    if (!emp) return false;
                    return !term || `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(term) || (emp.department || '').toLowerCase().includes(term);
                  });
                  
                  if (empList.length === 0) return (
                    <div className="table-empty"><i className="fas fa-users"></i><p className="mb-0">No employees found</p></div>
                  );
                  
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: '1rem' }}>
                      {empList.map(e => {
                        const emp = employees.find(x => x._id === e.id);
                        if (!emp) return null;
                        const initials = `${emp.firstName?.[0] || ''}${emp.lastName?.[0] || ''}`.toUpperCase();
                        const colors = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899'];
                        const color = colors[(emp.firstName?.charCodeAt(0) || 0) % colors.length];
                        
                        // Count by document type
                        const salarySlips = e.files.filter(f => f.subType === 'SALARY_SLIP').length;
                        const offerLetters = e.files.filter(f => f.subType === 'OFFER_LETTER').length;
                        const appraisals = e.files.filter(f => f.subType === 'APPRAISAL_LETTER').length;
                        const others = e.files.filter(f => !['SALARY_SLIP', 'OFFER_LETTER', 'APPRAISAL_LETTER'].includes(f.subType)).length;
                        
                        return (
                          <div key={e.id} onClick={() => setHrSelectedEmpId(e.id)}
                            style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '0.875rem', padding: '1.25rem 1rem', cursor: 'pointer', transition: 'box-shadow 0.15s, border-color 0.15s' }}
                            onMouseEnter={el => { el.currentTarget.style.boxShadow = '0 4px 16px rgba(16,185,129,0.12)'; el.currentTarget.style.borderColor = '#6ee7b7'; }}
                            onMouseLeave={el => { el.currentTarget.style.boxShadow = 'none'; el.currentTarget.style.borderColor = '#e2e8f0'; }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
                              <div style={{ width: 42, height: 42, borderRadius: '50%', background: color + '20', border: `2px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.95rem', color, flexShrink: 0 }}>
                                {initials}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.firstName} {emp.lastName}</div>
                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.department || emp.designation || 'No dept'}</div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '1rem', background: '#f1f5f9', color: '#475569' }}>
                                <i className="fas fa-file me-1"></i>{e.files.length} docs
                              </span>
                              {salarySlips > 0 && <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '1rem', background: '#ecfdf5', color: '#10b981' }}>
                                <i className="fas fa-file-invoice-dollar me-1"></i>{salarySlips} salary
                              </span>}
                              {offerLetters > 0 && <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '1rem', background: '#eef2ff', color: '#6366f1' }}>
                                <i className="fas fa-file-signature me-1"></i>{offerLetters} offer
                              </span>}
                              {appraisals > 0 && <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '1rem', background: '#fffbeb', color: '#f59e0b' }}>
                                <i className="fas fa-chart-line me-1"></i>{appraisals} appraisal
                              </span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                              <i className="fas fa-chevron-right" style={{ color: '#cbd5e1', fontSize: '0.75rem' }}></i>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* HR Documents - Selected Employee Detail */}
      {activeTab === 'hr_documents' && ['HR', 'ADMIN'].includes(user?.role) && hrSelectedEmpId && (() => {
        const emp = employees.find(x => x._id === hrSelectedEmpId);
        const empHrDocs = hrDocumentFiles.filter(f => f.targetUserId === hrSelectedEmpId);
        const initials = `${emp?.firstName?.[0] || ''}${emp?.lastName?.[0] || ''}`.toUpperCase();
        const colors = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899'];
        const color = colors[(emp?.firstName?.charCodeAt(0) || 0) % colors.length];
        
        return (
          <Row>
            <Col>
              <Card className="modern-table-wrapper">
                <Card.Header>
                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <div className="d-flex align-items-center gap-2">
                      <button onClick={() => setHrSelectedEmpId(null)} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
                        <i className="fas fa-arrow-left me-1"></i>Back
                      </button>
                      <span style={{ color: '#cbd5e1' }}>|</span>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: color + '20', border: `2px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', color }}>{initials}</div>
                      <div>
                        <h5 className="mb-0" style={{ fontSize: '0.95rem' }}>{emp?.firstName} {emp?.lastName}</h5>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{emp?.department || emp?.designation || ''}</div>
                      </div>
                    </div>
                    <Button size="sm" variant="success" onClick={() => { 
                      console.log('Selected employee ID:', hrSelectedEmpId);
                      console.log('Employee details:', employees.find(x => x._id === hrSelectedEmpId));
                      setFileForm({ type: 'HR_DOCUMENT', subType: 'SALARY_SLIP', category: '', description: '', targetUserId: hrSelectedEmpId, requiresAcknowledgment: false, visibility: { type: 'ALL', departments: [], roles: [], employees: [] }, month: new Date().getMonth() + 1, year: new Date().getFullYear() }); 
                      setUploadFolderId(null); 
                      setShowModal(true); 
                    }}>
                      <i className="fas fa-upload me-1"></i>Upload HR Doc for {emp?.firstName}
                    </Button>
                  </div>
                </Card.Header>
                <Card.Body className="p-0">
                  {empHrDocs.length === 0 ? (
                    <div className="table-empty"><i className="fas fa-folder-open"></i><p className="mb-0">No HR documents for this employee</p></div>
                  ) : (
                    <div className="table-responsive">
                      <Table className="table">
                        <thead>
                          <tr><th>Document Type</th><th>Name</th><th>Month/Year</th><th>Size</th><th>Date</th><th>Actions</th></tr>
                        </thead>
                        <tbody>
                          {empHrDocs.map(file => {
                            const subTypeInfo = getSubTypeInfo(file.subType);
                            return (
                              <tr key={file._id}>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ width: 32, height: 32, borderRadius: '0.4rem', background: subTypeInfo.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <i className={`fas ${subTypeInfo.icon}`} style={{ color: subTypeInfo.color, fontSize: '0.9rem' }}></i>
                                    </div>
                                    <span style={{ fontWeight: 600, color: subTypeInfo.color }}>{subTypeInfo.label}</span>
                                  </div>
                                </td>
                                <td>
                                  <div className="fw-semibold">{file.name}</div>
                                  {file.description && <small className="text-muted">{file.description}</small>}
                                </td>
                                <td>
                                  {file.month && file.year ? (
                                    <span className="text-muted">{MONTHS[file.month - 1]} {file.year}</span>
                                  ) : (
                                    <span style={{ color: '#cbd5e1' }}>—</span>
                                  )}
                                </td>
                                <td>{formatFileSize(file.size)}</td>
                                <td><span className="text-muted">{new Date(file.createdAt).toLocaleDateString()}</span></td>
                                <td>
                                  <div className="d-flex gap-1 flex-wrap">
                                    <Button size="sm" variant="outline-secondary" onClick={() => handlePreview(file)}><i className="fas fa-eye me-1"></i>Preview</Button>
                                    <Button size="sm" variant="outline-primary" onClick={() => handleDownload(file._id, file.originalName || file.name)}><i className="fas fa-download me-1"></i>Download</Button>
                                    <Button size="sm" variant="outline-danger" onClick={() => handleDeleteFile(file._id)}><i className="fas fa-trash me-1"></i>Delete</Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </Table>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        );
      })()}



      {/* Upload Modal */}
      <Modal show={showModal} onHide={() => !uploading && setShowModal(false)} size="lg" centered>
        <Form onSubmit={handleFileUpload} id="uploadForm">
          <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', borderBottom: 'none', borderRadius: '0.5rem 0.5rem 0 0', flexShrink: 0 }}>
            <Modal.Title style={{ fontWeight: 700, fontSize: '1.1rem' }}>
              <i className="fas fa-cloud-upload-alt me-2"></i>
              {uploadFolderId ? `Upload to "${activeFolder?.folder?.name || 'Folder'}"` : user?.role === 'EMPLOYEE' ? 'Upload My Document' : 'Upload Document'}
            </Modal.Title>
          </Modal.Header>

          <Modal.Body style={{ background: '#f0fdf4', padding: '1.5rem', overflowY: 'auto', maxHeight: '60vh' }}>

            {/* Drag & Drop Zone */}
            <div
              onClick={() => document.getElementById('fileInput').click()}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.background = '#ecfdf5'; }}
              onDragLeave={(e) => { e.currentTarget.style.borderColor = '#86efac'; e.currentTarget.style.background = '#fff'; }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = '#86efac';
                e.currentTarget.style.background = '#fff';
                const dropped = e.dataTransfer.files[0];
                if (dropped) setSelectedFile(dropped);
              }}
              style={{
                border: '2px dashed #86efac',
                borderRadius: '0.75rem',
                background: '#fff',
                padding: '2rem',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginBottom: '1.25rem'
              }}
            >
              <input
                id="fileInput"
                type="file"
                style={{ display: 'none' }}
                onChange={(e) => setSelectedFile(e.target.files[0])}
                required
              />
              {selectedFile ? (
                <div>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
                    <i className="fas fa-file-alt" style={{ fontSize: '1.4rem', color: '#10b981' }}></i>
                  </div>
                  <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem' }}>{selectedFile.name}</div>
                  <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                    {formatFileSize(selectedFile.size)}
                    <span
                      style={{ marginLeft: '0.75rem', color: '#10b981', cursor: 'pointer', fontWeight: 600 }}
                      onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                    >
                      <i className="fas fa-times me-1"></i>Remove
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
                    <i className="fas fa-cloud-upload-alt" style={{ fontSize: '1.6rem', color: '#10b981' }}></i>
                  </div>
                  <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.95rem' }}>Drag & drop your file here</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.25rem' }}>or <span style={{ color: '#10b981', fontWeight: 600 }}>click to browse</span></div>
                  <div style={{ color: '#cbd5e1', fontSize: '0.75rem', marginTop: '0.5rem' }}>PDF, DOC, XLS, PNG, JPG supported</div>
                </div>
              )}
            </div>

            {/* Section: Document Type Selection */}
            {user?.role !== 'EMPLOYEE' && (
              <div style={{ background: '#fff', borderRadius: '0.75rem', border: '1px solid #d1fae5', padding: '1.25rem', marginBottom: '1rem' }}>
                <div style={{ fontWeight: 700, color: '#374151', fontSize: '0.85rem', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#d1fae5', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fas fa-file-alt" style={{ color: '#10b981', fontSize: '0.75rem' }}></i>
                  </span>
                  Document Type
                </div>
                <div className="d-flex gap-2">
                  {[
                    { value: 'ORGANIZATION', icon: 'building', label: 'Organization', desc: 'Policies, handbooks, forms', color: '#10b981' },
                    { value: 'EMPLOYEE', icon: 'user', label: 'Employee', desc: 'Joining docs, ID proofs', color: '#059669' },
                    { value: 'HR_DOCUMENT', icon: 'file-invoice-dollar', label: 'HR Document', desc: 'Salary slips, letters', color: '#047857' }
                  ].map(t => (
                    <div
                      key={t.value}
                      onClick={() => setFileForm({ ...fileForm, type: t.value, targetUserId: '', category: '', subType: t.value === 'HR_DOCUMENT' ? 'SALARY_SLIP' : '' })}
                      style={{
                        flex: 1, padding: '0.75rem 0.65rem', borderRadius: '0.6rem', cursor: 'pointer', textAlign: 'center', fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.15s',
                        border: fileForm.type === t.value ? `2px solid ${t.color}` : '2px solid #d1fae5',
                        background: fileForm.type === t.value ? `${t.color}15` : '#f0fdf4',
                        color: fileForm.type === t.value ? t.color : '#64748b'
                      }}
                    >
                      <i className={`fas fa-${t.icon}`} style={{ display: 'block', fontSize: '1.3rem', marginBottom: '0.4rem' }}></i>
                      <div style={{ fontWeight: 700, marginBottom: '0.15rem' }}>{t.label}</div>
                      <div style={{ fontSize: '0.68rem', opacity: 0.8 }}>{t.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section: File Details */}
            <div style={{ background: '#fff', borderRadius: '0.75rem', border: '1px solid #d1fae5', padding: '1.25rem', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700, color: '#374151', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#d1fae5', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fas fa-info-circle" style={{ color: '#10b981', fontSize: '0.75rem' }}></i>
                </span>
                {fileForm.type === 'EMPLOYEE' ? 'Employee Document Details' : 'Document Details'}
              </div>
              <Row className="g-3">
                {/* HR Document Sub-Type */}
                {fileForm.type === 'HR_DOCUMENT' && (
                  <Col md={12}>
                    <Form.Label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>HR Document Type <span className="text-danger">*</span></Form.Label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.5rem' }}>
                      {HR_SUB_TYPES.map(st => {
                        const selected = fileForm.subType === st.value;
                        return (
                          <div
                            key={st.value}
                            onClick={() => setFileForm({ ...fileForm, subType: st.value })}
                            style={{
                              padding: '0.6rem 0.75rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.15s',
                              border: selected ? `2px solid ${st.color}` : '1.5px solid #e2e8f0',
                              background: selected ? st.bg : '#f8fafc',
                              color: selected ? st.color : '#64748b',
                              display: 'flex', alignItems: 'center', gap: '0.5rem'
                            }}
                          >
                            <i className={`fas ${st.icon}`} style={{ fontSize: '0.9rem' }}></i>
                            <span>{st.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </Col>
                )}

                {/* Category - Only for non-HR documents */}
                {fileForm.type !== 'HR_DOCUMENT' && (
                  <Col md={fileForm.type === 'EMPLOYEE' && user?.role !== 'EMPLOYEE' ? 6 : 12}>
                    <Form.Label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>Category</Form.Label>
                    <Form.Select
                      value={fileForm.category}
                      onChange={(e) => setFileForm({ ...fileForm, category: e.target.value })}
                      style={{ fontSize: '0.85rem', borderRadius: '0.5rem' }}
                    >
                      <option value="">Select category...</option>
                      {fileForm.type === 'EMPLOYEE' ? (
                        ['Aadhar Card', 'PAN Card', 'Passport', 'Driving License', 'Voter ID', 'Educational Certificate', 'Experience Letter', 'Resume', 'Bank Details', 'Other'].map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))
                      ) : (
                        ['Policy', 'Handbook', 'Form', 'Contract', 'Offer Letter', 'Announcement', 'Guideline', 'Other'].map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))
                      )}
                    </Form.Select>
                  </Col>
                )}

                {/* Employee Selection */}
                {(fileForm.type === 'EMPLOYEE' || fileForm.type === 'HR_DOCUMENT') && user?.role !== 'EMPLOYEE' && (
                  <Col md={fileForm.type === 'EMPLOYEE' ? 6 : 12}>
                    <Form.Label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>
                      {fileForm.type === 'HR_DOCUMENT' ? 'Select Employee' : 'Assign to Employee'} <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Select
                      value={fileForm.targetUserId}
                      onChange={(e) => setFileForm({ ...fileForm, targetUserId: e.target.value })}
                      required={fileForm.type === 'EMPLOYEE' || fileForm.type === 'HR_DOCUMENT'}
                      style={{ fontSize: '0.85rem', borderRadius: '0.5rem' }}
                    >
                      <option value="">Select employee...</option>
                      {employees.map(emp => (
                        <option key={emp._id} value={emp._id}>
                          {emp.firstName} {emp.lastName} — {emp.department || 'No dept'}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                )}

                {/* Month & Year for HR Documents */}
                {fileForm.type === 'HR_DOCUMENT' && (
                  <>
                    <Col md={6}>
                      <Form.Label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>Month</Form.Label>
                      <Form.Select
                        value={fileForm.month}
                        onChange={(e) => setFileForm({ ...fileForm, month: e.target.value })}
                        style={{ fontSize: '0.85rem', borderRadius: '0.5rem' }}
                      >
                        <option value="">Select month...</option>
                        {MONTHS.map((m, idx) => (
                          <option key={idx} value={idx + 1}>{m}</option>
                        ))}
                      </Form.Select>
                    </Col>
                    <Col md={6}>
                      <Form.Label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>Year</Form.Label>
                      <Form.Select
                        value={fileForm.year}
                        onChange={(e) => setFileForm({ ...fileForm, year: e.target.value })}
                        style={{ fontSize: '0.85rem', borderRadius: '0.5rem' }}
                      >
                        <option value="">Select year...</option>
                        {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </Form.Select>
                    </Col>
                  </>
                )}

                <Col md={12}>
                  <Form.Label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>Description <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={fileForm.description}
                    onChange={(e) => setFileForm({ ...fileForm, description: e.target.value })}
                    placeholder="Brief description of this document..."
                    style={{ fontSize: '0.85rem', borderRadius: '0.5rem', resize: 'none' }}
                  />
                </Col>
              </Row>
            </div>

            {/* Section: Visibility — only for ORGANIZATION type */}
            {fileForm.type === 'ORGANIZATION' && (
              <div style={{ background: '#fff', borderRadius: '0.75rem', border: '1px solid #d1fae5', padding: '1.25rem', marginBottom: '1rem' }}>
                <div style={{ fontWeight: 700, color: '#374151', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#fef3c7', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fas fa-eye" style={{ color: '#d97706', fontSize: '0.75rem' }}></i>
                  </span>
                  Visibility — Who can view this?
                </div>

                {/* Visibility type cards */}
                <div className="d-flex gap-2 flex-wrap mb-3">
                  {[
                    { value: 'ALL', icon: 'globe', label: 'Everyone', color: '#10b981', bg: '#ecfdf5' },
                    { value: 'DEPARTMENTS', icon: 'building', label: 'Departments', color: '#3b82f6', bg: '#eff6ff' },
                    { value: 'ROLES', icon: 'user-tag', label: 'By Role', color: '#f59e0b', bg: '#fffbeb' },
                    { value: 'SPECIFIC_EMPLOYEES', icon: 'users', label: 'Specific', color: '#8b5cf6', bg: '#f5f3ff' },
                  ].map(opt => (
                    <div
                      key={opt.value}
                      onClick={() => handleVisibilityChange('type', opt.value)}
                      style={{
                        flex: '1 1 calc(25% - 0.5rem)', minWidth: 90, padding: '0.65rem 0.5rem', borderRadius: '0.6rem', cursor: 'pointer',
                        textAlign: 'center', fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.15s',
                        border: fileForm.visibility.type === opt.value ? `2px solid ${opt.color}` : '2px solid #e2e8f0',
                        background: fileForm.visibility.type === opt.value ? opt.bg : '#f8fafc',
                        color: fileForm.visibility.type === opt.value ? opt.color : '#64748b'
                      }}
                    >
                      <i className={`fas fa-${opt.icon}`} style={{ display: 'block', fontSize: '1.1rem', marginBottom: '0.3rem' }}></i>
                      {opt.label}
                    </div>
                  ))}
                </div>

                {/* Departments picker */}
                {fileForm.visibility.type === 'DEPARTMENTS' && (
                  <div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.5rem' }}>
                      Select departments ({fileForm.visibility.departments.length} selected)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.4rem', maxHeight: 160, overflowY: 'auto' }}>
                      {departments.map(dept => {
                        const checked = fileForm.visibility.departments.includes(dept._id);
                        return (
                          <div
                            key={dept._id}
                            onClick={() => handleVisibilityMultiToggle('departments', dept._id)}
                            style={{
                              padding: '0.45rem 0.65rem', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500,
                              border: checked ? '1.5px solid #3b82f6' : '1.5px solid #e2e8f0',
                              background: checked ? '#eff6ff' : '#f8fafc',
                              color: checked ? '#3b82f6' : '#374151',
                              display: 'flex', alignItems: 'center', gap: '0.4rem'
                            }}
                          >
                            <i className={`fas fa-${checked ? 'check-square' : 'square'}`} style={{ fontSize: '0.75rem' }}></i>
                            {dept.name}
                          </div>
                        );
                      })}
                      {departments.length === 0 && <small className="text-muted">No departments found</small>}
                    </div>
                  </div>
                )}

                {/* Roles picker */}
                {fileForm.visibility.type === 'ROLES' && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {[{ value: 'MANAGER', icon: 'user-tie', color: '#f59e0b', bg: '#fffbeb' }, { value: 'EMPLOYEE', icon: 'user', color: '#6366f1', bg: '#eef2ff' }].map(r => {
                      const checked = fileForm.visibility.roles.includes(r.value);
                      return (
                        <div
                          key={r.value}
                          onClick={() => handleVisibilityMultiToggle('roles', r.value)}
                          style={{
                            padding: '0.6rem 1.2rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                            border: checked ? `2px solid ${r.color}` : '2px solid #e2e8f0',
                            background: checked ? r.bg : '#f8fafc',
                            color: checked ? r.color : '#64748b',
                            display: 'flex', alignItems: 'center', gap: '0.5rem'
                          }}
                        >
                          <i className={`fas fa-${r.icon}`}></i>
                          {r.value.charAt(0) + r.value.slice(1).toLowerCase()}
                          {checked && <i className="fas fa-check" style={{ fontSize: '0.7rem' }}></i>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Specific employees picker */}
                {fileForm.visibility.type === 'SPECIFIC_EMPLOYEES' && (
                  <div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.5rem' }}>
                      Select employees ({fileForm.visibility.employees.length} selected)
                    </div>
                    <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      {employees.map(emp => {
                        const checked = fileForm.visibility.employees.includes(emp._id);
                        return (
                          <div
                            key={emp._id}
                            onClick={() => handleVisibilityMultiToggle('employees', emp._id)}
                            style={{
                              padding: '0.45rem 0.75rem', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.82rem',
                              border: checked ? '1.5px solid #8b5cf6' : '1.5px solid #e2e8f0',
                              background: checked ? '#f5f3ff' : '#f8fafc',
                              color: checked ? '#7c3aed' : '#374151',
                              display: 'flex', alignItems: 'center', gap: '0.5rem'
                            }}
                          >
                            <i className={`fas fa-${checked ? 'check-circle' : 'circle'}`} style={{ fontSize: '0.75rem', color: checked ? '#8b5cf6' : '#cbd5e1' }}></i>
                            <span style={{ fontWeight: 600 }}>{emp.firstName} {emp.lastName}</span>
                            <span style={{ color: '#94a3b8', fontSize: '0.75rem', marginLeft: 'auto' }}>{emp.department || 'No dept'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Section: Options */}
            <div style={{ background: '#fff', borderRadius: '0.75rem', border: '1px solid #d1fae5', padding: '1rem 1.25rem' }}>
              <div
                onClick={() => setFileForm({ ...fileForm, requiresAcknowledgment: !fileForm.requiresAcknowledgment })}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
                  padding: '0.4rem 0'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <span style={{ width: 32, height: 32, borderRadius: '0.4rem', background: fileForm.requiresAcknowledgment ? '#d1fae5' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fas fa-signature" style={{ color: fileForm.requiresAcknowledgment ? '#10b981' : '#94a3b8', fontSize: '0.85rem' }}></i>
                  </span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e293b' }}>Requires Acknowledgment</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Employees must confirm they have read this document</div>
                  </div>
                </div>
                <div style={{
                  width: 40, height: 22, borderRadius: 11, background: fileForm.requiresAcknowledgment ? '#10b981' : '#cbd5e1',
                  position: 'relative', transition: 'background 0.2s', flexShrink: 0
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: 2, left: fileForm.requiresAcknowledgment ? 20 : 2,
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                  }}></div>
                </div>
              </div>
            </div>

          </Modal.Body>

          <Modal.Footer style={{ background: '#f0fdf4', borderTop: '1px solid #d1fae5', padding: '1rem 1.5rem', display: 'flex !important', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <Button
              variant="light"
              onClick={() => setShowModal(false)}
              disabled={uploading}
              style={{ fontWeight: 600, fontSize: '0.85rem', borderRadius: '0.5rem', border: '1.5px solid #d1fae5', background: '#fff', color: '#64748b', padding: '0.5rem 1.5rem' }}
            >
              <i className="fas fa-times me-2"></i>Cancel
            </Button>
            <Button
              type="submit"
              disabled={uploading || !selectedFile}
              style={{
                background: uploading ? '#6ee7b7' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none', fontWeight: 700, fontSize: '0.85rem', borderRadius: '0.5rem',
                padding: '0.5rem 1.5rem', minWidth: 130, color: '#fff'
              }}
            >
              {uploading ? (
                <><span className="spinner-border spinner-border-sm me-2" role="status"></span>Uploading...</>
              ) : (
                <><i className="fas fa-cloud-upload-alt me-2"></i>Upload File</>
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Acknowledgment Modal */}
      <Modal show={showAckModal} onHide={() => setShowAckModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Acknowledge Document</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>You are about to acknowledge that you have read and understood:</p>
          <div className="bg-light p-3 rounded mb-3">
            <strong>{selectedFileForAck?.name}</strong>
            {selectedFileForAck?.description && (
              <div className="text-muted mt-1">
                {selectedFileForAck.description}
              </div>
            )}
          </div>
          <Form.Group>
            <Form.Label>Comments (Optional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={ackComments}
              onChange={(e) => setAckComments(e.target.value)}
              placeholder="Any comments or questions about this document..."
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAckModal(false)}>
            Cancel
          </Button>
          <Button variant="success" onClick={submitAcknowledgment}>
            <i className="fas fa-check me-2"></i>
            Acknowledge Document
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Preview Modal */}
      <Modal
        show={showPreviewModal}
        onHide={closePreview}
        size="xl"
        centered
        dialogClassName={isFullscreen ? 'preview-modal-fullscreen' : ''}
      >
        <style>{`
          .preview-modal-fullscreen .modal-dialog { max-width: 100vw !important; margin: 0 !important; }
          .preview-modal-fullscreen .modal-content { height: 100vh; border-radius: 0 !important; }
          .preview-modal-fullscreen .preview-body { height: calc(100vh - 120px) !important; }
          @media (max-width: 576px) {
            .modal-dialog { margin: 0 !important; }
            .modal-content { border-radius: 1rem 1rem 0 0 !important; position: fixed !important; bottom: 0 !important; left: 0 !important; right: 0 !important; max-height: 95vh; }
            .preview-body { height: 60vh !important; }
          }
        `}</style>

        {/* Custom Header */}
        <div style={{
          background: 'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)',
          padding: '0.85rem 1.25rem',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          borderRadius: isFullscreen ? 0 : '0.5rem 0.5rem 0 0',
          flexShrink: 0
        }}>
          {/* File type icon */}
          {previewFile && (() => {
            const fi = getFileIcon(previewFile.mimeType);
            return (
              <div style={{ width: 38, height: 38, borderRadius: '0.5rem', background: fi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`fas ${fi.icon}`} style={{ color: fi.color, fontSize: '1.1rem' }}></i>
              </div>
            );
          })()}

          {/* File info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {previewFile?.originalName || previewFile?.name}
            </div>
            <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: '0.1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {previewFile?.size && <span><i className="fas fa-hdd me-1"></i>{formatFileSize(previewFile.size)}</span>}
              {previewFile?.category && <span><i className="fas fa-tag me-1"></i>{previewFile.category}</span>}
              {previewFile?.createdAt && <span><i className="fas fa-calendar me-1"></i>{new Date(previewFile.createdAt).toLocaleDateString()}</span>}
            </div>
          </div>

          {/* Toolbar */}
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
            {previewFile?.mimeType?.startsWith('image/') && previewUrl && (
              <>
                <button onClick={() => setImgZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))} title="Zoom out"
                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#e2e8f0', borderRadius: '0.4rem', width: 32, height: 32, cursor: 'pointer', fontSize: '0.85rem' }}>
                  <i className="fas fa-search-minus"></i>
                </button>
                <span style={{ color: '#94a3b8', fontSize: '0.75rem', minWidth: 36, textAlign: 'center' }}>{Math.round(imgZoom * 100)}%</span>
                <button onClick={() => setImgZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))} title="Zoom in"
                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#e2e8f0', borderRadius: '0.4rem', width: 32, height: 32, cursor: 'pointer', fontSize: '0.85rem' }}>
                  <i className="fas fa-search-plus"></i>
                </button>
                <button onClick={() => setImgZoom(1)} title="Reset zoom"
                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#e2e8f0', borderRadius: '0.4rem', width: 32, height: 32, cursor: 'pointer', fontSize: '0.85rem' }}>
                  <i className="fas fa-compress-arrows-alt"></i>
                </button>
              </>
            )}
            <button onClick={() => setIsFullscreen(f => !f)} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#e2e8f0', borderRadius: '0.4rem', width: 32, height: 32, cursor: 'pointer', fontSize: '0.85rem' }}>
              <i className={`fas fa-${isFullscreen ? 'compress' : 'expand'}`}></i>
            </button>
            {previewUrl && (
              <button onClick={() => handleDownload(previewFile._id, previewFile.originalName || previewFile.name)} title="Download"
                style={{ background: 'rgba(99,102,241,0.25)', border: 'none', color: '#a5b4fc', borderRadius: '0.4rem', width: 32, height: 32, cursor: 'pointer', fontSize: '0.85rem' }}>
                <i className="fas fa-download"></i>
              </button>
            )}
            {previewUrl && (
              <button onClick={handlePrint} title="Print"
                style={{ background: 'rgba(16,185,129,0.2)', border: 'none', color: '#6ee7b7', borderRadius: '0.4rem', width: 32, height: 32, cursor: 'pointer', fontSize: '0.85rem' }}>
                <i className="fas fa-print"></i>
              </button>
            )}
            <button onClick={closePreview} title="Close"
              style={{ background: 'rgba(239,68,68,0.2)', border: 'none', color: '#fca5a5', borderRadius: '0.4rem', width: 32, height: 32, cursor: 'pointer', fontSize: '0.85rem' }}>
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        {/* Preview Body */}
        <div className="preview-body" style={{
          background: '#0f172a',
          height: isFullscreen ? 'calc(100vh - 120px)' : '75vh',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'auto', position: 'relative'
        }}>
          {previewLoading ? (
            <div style={{ textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <div className="spinner-border text-primary" role="status" style={{ width: '1.75rem', height: '1.75rem' }}></div>
              </div>
              <div style={{ fontWeight: 600, color: '#e2e8f0' }}>Loading preview...</div>
              <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Fetching secure document</div>
            </div>
          ) : previewUrl ? (
            previewFile?.mimeType?.startsWith('image/') ? (
              <div style={{ overflow: 'auto', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img
                  src={previewUrl}
                  alt={previewFile?.name}
                  style={{
                    transform: `scale(${imgZoom})`,
                    transformOrigin: 'center center',
                    transition: 'transform 0.2s',
                    maxWidth: imgZoom <= 1 ? '100%' : 'none',
                    maxHeight: imgZoom <= 1 ? '100%' : 'none',
                    objectFit: 'contain',
                    borderRadius: '0.5rem',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                  }}
                />
              </div>
            ) : previewFile?.mimeType === 'application/pdf' ? (
              <iframe
                src={previewUrl}
                title={previewFile?.name}
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            ) : (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                {(() => { const fi = getFileIcon(previewFile?.mimeType); return (
                  <div style={{ width: 72, height: 72, borderRadius: '1rem', background: fi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                    <i className={`fas ${fi.icon}`} style={{ color: fi.color, fontSize: '2rem' }}></i>
                  </div>
                ); })()}
                <div style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '1rem', marginBottom: '0.5rem' }}>Preview not available</div>
                <div style={{ fontSize: '0.82rem', marginBottom: '1.5rem' }}>This file type cannot be previewed in the browser.</div>
                <button
                  onClick={() => handleDownload(previewFile._id, previewFile.originalName || previewFile.name)}
                  style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', color: '#fff', borderRadius: '0.5rem', padding: '0.6rem 1.5rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  <i className="fas fa-download me-2"></i>Download to view
                </button>
              </div>
            )
          ) : (
            <div style={{ textAlign: 'center', color: '#94a3b8' }}>
              <i className="fas fa-exclamation-triangle" style={{ fontSize: '2.5rem', color: '#f59e0b', marginBottom: '1rem', display: 'block' }}></i>
              <div style={{ fontWeight: 600, color: '#e2e8f0' }}>Could not load preview</div>
              <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Please try downloading the file instead.</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          background: '#1e293b', borderTop: '1px solid #334155',
          padding: '0.65rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0, flexWrap: 'wrap', gap: '0.5rem'
        }}>
          <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
            {previewFile?.mimeType && <span><i className="fas fa-info-circle me-1"></i>{previewFile.mimeType}</span>}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={closePreview}
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid #334155', color: '#94a3b8', borderRadius: '0.4rem', padding: '0.4rem 1rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
              Close
            </button>
            {previewUrl && (
              <button onClick={() => handleDownload(previewFile._id, previewFile.originalName || previewFile.name)}
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', color: '#fff', borderRadius: '0.4rem', padding: '0.4rem 1rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
                <i className="fas fa-download me-2"></i>Download
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* Verification Modal */}
      <Modal show={showVerifyModal} onHide={() => setShowVerifyModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Verify Document</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="bg-light p-3 rounded mb-3">
            <strong>{selectedFileForVerify?.name}</strong>
            {selectedFileForVerify?.description && (
              <div className="text-muted mt-1">
                {selectedFileForVerify.description}
              </div>
            )}
          </div>
          
          <Form.Group className="mb-3">
            <Form.Label>Verification Status</Form.Label>
            <Form.Select
              value={verifyForm.verificationStatus}
              onChange={(e) => setVerifyForm({ verificationStatus: e.target.value })}
            >
              <option value="UNVERIFIED">Unverified</option>
              <option value="VERIFIED">Verified</option>
              <option value="EXPIRED">Expired</option>
              <option value="INVALID">Invalid</option>
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowVerifyModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submitVerification}>
            <i className="fas fa-certificate me-2"></i>
            Update Verification
          </Button>
        </Modal.Footer>
      </Modal>
      {/* Assign to Folder Modal */}
      <Modal show={showAssignModal} onHide={() => { setShowAssignModal(false); setAssignFile(null); }} centered size="sm">
        <Modal.Header closeButton style={{ background: 'linear-gradient(135deg,#7c3aed,#6366f1)', color: '#fff', borderBottom: 'none', borderRadius: '0.5rem 0.5rem 0 0' }}>
          <Modal.Title style={{ fontWeight: 700, fontSize: '1rem' }}>
            <i className="fas fa-folder-open me-2"></i>Move to Folder
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ background: '#f8fafc', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.75rem' }}>
            Moving: <strong style={{ color: '#1e293b' }}>{assignFile?.name}</strong>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div onClick={() => handleAssignToFolder(null)}
              style={{ padding: '0.55rem 0.75rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                border: !assignFile?.folderId ? '2px solid #6366f1' : '1.5px solid #e2e8f0',
                background: !assignFile?.folderId ? '#eef2ff' : '#fff', color: !assignFile?.folderId ? '#6366f1' : '#374151',
                display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <i className="fas fa-times-circle" style={{ color: '#94a3b8' }}></i> No Folder (remove)
            </div>
            {folders.map(folder => (
              <div key={folder._id} onClick={() => handleAssignToFolder(folder._id)}
                style={{ padding: '0.55rem 0.75rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                  border: String(assignFile?.folderId) === String(folder._id) ? `2px solid ${folder.color}` : '1.5px solid #e2e8f0',
                  background: String(assignFile?.folderId) === String(folder._id) ? folder.color + '15' : '#fff',
                  color: '#374151', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <i className="fas fa-folder" style={{ color: folder.color }}></i>
                {folder.name}
                {String(assignFile?.folderId) === String(folder._id) && <i className="fas fa-check ms-auto" style={{ color: folder.color, fontSize: '0.75rem' }}></i>}
              </div>
            ))}
            {folders.length === 0 && <small className="text-muted">No folders yet — create one first</small>}
          </div>
        </Modal.Body>
      </Modal>

      {/* Create / Edit Folder Modal — 2-step wizard */}
      <Modal show={showFolderModal} onHide={() => { setShowFolderModal(false); setFolderStep(1); }} centered size="md">
        <div>
          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', padding: '1rem 1.25rem', borderRadius: '0.5rem 0.5rem 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>
              <i className="fas fa-folder-plus me-2"></i>
              {editingFolder ? 'Edit Folder' : 'New Folder'}
            </div>
            {/* Step indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {[1, 2].map(s => (
                <div key={s} style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 700,
                  background: folderStep === s ? '#fff' : 'rgba(255,255,255,0.3)',
                  color: folderStep === s ? '#d97706' : '#fff'
                }}>{s}</div>
              ))}
              <button type="button" onClick={() => { setShowFolderModal(false); setFolderStep(1); }}
                style={{ background: 'none', border: 'none', color: '#fff', marginLeft: '0.5rem', fontSize: '1rem', cursor: 'pointer', opacity: 0.8 }}>
                <i className="fas fa-times"></i>
              </button>
            </div>
          </div>

          <Modal.Body style={{ background: '#f8fafc', padding: '1.5rem' }}>

            {/* ── Step 1: Basics + Access Type ── */}
            {folderStep === 1 && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Folder Name <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    required
                    autoFocus
                    value={folderForm.name}
                    onChange={e => setFolderForm({ ...folderForm, name: e.target.value })}
                    placeholder="e.g. HR Policies 2025"
                    style={{ borderRadius: '0.5rem', fontSize: '0.85rem' }}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Description <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></Form.Label>
                  <Form.Control
                    as="textarea" rows={2}
                    value={folderForm.description}
                    onChange={e => setFolderForm({ ...folderForm, description: e.target.value })}
                    placeholder="Brief description..."
                    style={{ borderRadius: '0.5rem', fontSize: '0.85rem', resize: 'none' }}
                  />
                </Form.Group>

                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Access Type</Form.Label>
                  <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '0.5rem', padding: '0.25rem', gap: '0.25rem' }}>
                    {[
                      { value: 'FULL', icon: 'unlock-alt', label: 'Full Access', sub: 'View, download & print', color: '#10b981' },
                      { value: 'VIEW_PRINT', icon: 'eye', label: 'View & Print', sub: 'No download', color: '#ef4444' }
                    ].map(opt => (
                      <div key={opt.value} onClick={() => setFolderForm({ ...folderForm, accessType: opt.value })}
                        style={{
                          flex: 1, padding: '0.55rem 0.75rem', borderRadius: '0.35rem', cursor: 'pointer',
                          background: folderForm.accessType === opt.value ? '#fff' : 'transparent',
                          boxShadow: folderForm.accessType === opt.value ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                          transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '0.6rem'
                        }}
                      >
                        <i className={`fas fa-${opt.icon}`} style={{ fontSize: '0.95rem', color: folderForm.accessType === opt.value ? opt.color : '#94a3b8', flexShrink: 0 }}></i>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.8rem', color: folderForm.accessType === opt.value ? '#1e293b' : '#64748b', lineHeight: 1.2 }}>{opt.label}</div>
                          <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.1rem' }}>{opt.sub}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Form.Group>
              </>
            )}

            {/* ── Step 2: Visibility + Tags ── */}
            {folderStep === 2 && (
              <>
                {/* Visibility type pills */}
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#374151', marginBottom: '0.65rem' }}>
                  <i className="fas fa-eye me-2 text-warning"></i>Who can see this folder?
                </div>
                <div className="d-flex gap-2 flex-wrap mb-3">
                  {[
                    { value: 'ALL', icon: 'globe', label: 'Everyone', color: '#10b981', bg: '#ecfdf5' },
                    { value: 'DEPARTMENTS', icon: 'building', label: 'Departments', color: '#3b82f6', bg: '#eff6ff' },
                    { value: 'ROLES', icon: 'user-tag', label: 'By Role', color: '#f59e0b', bg: '#fffbeb' },
                    { value: 'SPECIFIC_EMPLOYEES', icon: 'users', label: 'Specific', color: '#8b5cf6', bg: '#f5f3ff' },
                  ].map(opt => (
                    <div key={opt.value}
                      onClick={() => setFolderForm(prev => ({ ...prev, visibility: { ...prev.visibility, type: opt.value } }))}
                      style={{
                        flex: '1 1 calc(25% - 0.5rem)', minWidth: 80, padding: '0.6rem 0.4rem', borderRadius: '0.6rem', cursor: 'pointer',
                        textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.15s',
                        border: folderForm.visibility.type === opt.value ? `2px solid ${opt.color}` : '2px solid #e2e8f0',
                        background: folderForm.visibility.type === opt.value ? opt.bg : '#f8fafc',
                        color: folderForm.visibility.type === opt.value ? opt.color : '#64748b'
                      }}
                    >
                      <i className={`fas fa-${opt.icon}`} style={{ display: 'block', fontSize: '1rem', marginBottom: '0.25rem' }}></i>
                      {opt.label}
                    </div>
                  ))}
                </div>

                {/* Departments sub-picker */}
                {folderForm.visibility.type === 'DEPARTMENTS' && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.4rem' }}>
                      {folderForm.visibility.departments.length} selected
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px,1fr))', gap: '0.35rem', maxHeight: 150, overflowY: 'auto' }}>
                      {departments.map(dept => {
                        const on = folderForm.visibility.departments.includes(String(dept._id));
                        return (
                          <div key={dept._id} onClick={() => handleFolderVisibilityToggle('departments', dept._id)}
                            style={{
                              padding: '0.4rem 0.6rem', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500,
                              border: on ? '1.5px solid #3b82f6' : '1.5px solid #e2e8f0',
                              background: on ? '#eff6ff' : '#f8fafc', color: on ? '#3b82f6' : '#374151',
                              display: 'flex', alignItems: 'center', gap: '0.4rem'
                            }}
                          >
                            <i className={`fas fa-${on ? 'check-square' : 'square'}`} style={{ fontSize: '0.72rem' }}></i>
                            {dept.name}
                          </div>
                        );
                      })}
                      {departments.length === 0 && <small className="text-muted">No departments found</small>}
                    </div>
                  </div>
                )}

                {/* Roles sub-picker */}
                {folderForm.visibility.type === 'ROLES' && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    {[
                      { value: 'MANAGER', icon: 'user-tie', color: '#f59e0b', bg: '#fffbeb' },
                      { value: 'EMPLOYEE', icon: 'user', color: '#6366f1', bg: '#eef2ff' }
                    ].map(r => {
                      const on = folderForm.visibility.roles.includes(r.value);
                      return (
                        <div key={r.value} onClick={() => handleFolderVisibilityToggle('roles', r.value)}
                          style={{
                            padding: '0.55rem 1.1rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                            border: on ? `2px solid ${r.color}` : '2px solid #e2e8f0',
                            background: on ? r.bg : '#f8fafc', color: on ? r.color : '#64748b',
                            display: 'flex', alignItems: 'center', gap: '0.45rem'
                          }}
                        >
                          <i className={`fas fa-${r.icon}`}></i>
                          {r.value.charAt(0) + r.value.slice(1).toLowerCase()}
                          {on && <i className="fas fa-check" style={{ fontSize: '0.65rem' }}></i>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Specific employees sub-picker */}
                {folderForm.visibility.type === 'SPECIFIC_EMPLOYEES' && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.4rem' }}>
                      {folderForm.visibility.employees.length} selected
                    </div>
                    <div style={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      {employees.map(emp => {
                        const on = folderForm.visibility.employees.includes(String(emp._id));
                        return (
                          <div key={emp._id} onClick={() => handleFolderVisibilityToggle('employees', emp._id)}
                            style={{
                              padding: '0.4rem 0.7rem', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.82rem',
                              border: on ? '1.5px solid #8b5cf6' : '1.5px solid #e2e8f0',
                              background: on ? '#f5f3ff' : '#f8fafc', color: on ? '#7c3aed' : '#374151',
                              display: 'flex', alignItems: 'center', gap: '0.5rem'
                            }}
                          >
                            <i className={`fas fa-${on ? 'check-circle' : 'circle'}`} style={{ fontSize: '0.72rem', color: on ? '#8b5cf6' : '#cbd5e1' }}></i>
                            <span style={{ fontWeight: 600 }}>{emp.firstName} {emp.lastName}</span>
                            <span style={{ color: '#94a3b8', fontSize: '0.73rem', marginLeft: 'auto' }}>{emp.department || '—'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tags */}
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Tags <span style={{ color: '#94a3b8', fontWeight: 400 }}>(comma-separated)</span></Form.Label>
                  <Form.Control
                    value={folderForm.tags}
                    onChange={e => setFolderForm({ ...folderForm, tags: e.target.value })}
                    placeholder="e.g. policy, 2025, hr"
                    style={{ borderRadius: '0.5rem', fontSize: '0.85rem' }}
                  />
                </Form.Group>
              </>
            )}
          </Modal.Body>

          <Modal.Footer style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', gap: '0.5rem' }}>
            {folderStep === 1 ? (
              <>
                <Button variant="light" onClick={() => { setShowFolderModal(false); setFolderStep(1); }}
                  style={{ fontWeight: 600, fontSize: '0.85rem', border: '1.5px solid #e2e8f0' }}>Cancel</Button>
                <Button
                  disabled={!folderForm.name.trim()}
                  onClick={() => setFolderStep(2)}
                  style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', border: 'none', fontWeight: 700, fontSize: '0.85rem' }}
                >
                  Next <i className="fas fa-arrow-right ms-1"></i>
                </Button>
              </>
            ) : (
              <>
                <Button variant="light" onClick={() => setFolderStep(1)}
                  style={{ fontWeight: 600, fontSize: '0.85rem', border: '1.5px solid #e2e8f0' }}>
                  <i className="fas fa-arrow-left me-1"></i>Back
                </Button>
                <Button onClick={handleCreateFolder} style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', border: 'none', fontWeight: 700, fontSize: '0.85rem' }}>
                  <i className="fas fa-folder-plus me-2"></i>{editingFolder ? 'Save Changes' : 'Create Folder'}
                </Button>
              </>
            )}
          </Modal.Footer>
        </div>
      </Modal>
    </div>
  );
};

export default Files;
