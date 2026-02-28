export const showAnnouncementNotification = async (announcement) => {
  if (!('Notification' in window)) return;
  
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return;

  const registration = await navigator.serviceWorker.ready;
  registration.showNotification(announcement.title, {
    body: announcement.content,
    icon: '/logo192.png',
    badge: '/logo192.png',
    tag: 'announcement',
    requireInteraction: announcement.priority === 'High'
  });
};
