import { db, auth, playSound } from './firebase-config.js';
import { 
  collection, addDoc, query, where, onSnapshot, updateDoc, doc, getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let currentUser = null;
let currentMasterId = null;
let currentRequestId = null;
let selectedService = null;
let selectedTime = null;

const MASTERS = [
  { id: "master1", name: "Наталья", spec: "Ресницы / Брови", avatarBg: "#9b59b6", services: ["Наращивание ресниц", "Ламинирование ресниц", "Ламинирование бровей", "Архитектура бровей", "Окрашивание бровей"] },
  { id: "master2", name: "Кристина", spec: "Ресницы", avatarBg: "#e74c3c", services: ["Наращивание ресниц"] },
  { id: "master3", name: "Таня", spec: "Ресницы / Брови", avatarBg: "#f39c12", services: ["Наращивание ресниц", "Ламинирование ресниц", "Ламинирование бровей", "Архитектура бровей", "Окрашивание бровей"] },
  { id: "master4", name: "Анна", spec: "Стилист", avatarBg: "#2ecc71", services: ["Стрижка", "Окрашивание", "Укладка"] },
  { id: "master5", name: "Елена", spec: "Маникюр", avatarBg: "#e67e22", services: ["Маникюр", "Педикюр"] }
];

function loadMasters() {
  const grid = document.getElementById('mastersGrid');
  if (!grid) {
    console.log('mastersGrid не найден');
    return;
  }
  
  console.log('Загружаем мастеров...');
  
  grid.innerHTML = MASTERS.map(m => `
    <div class="master-card" onclick="selectMaster('${m.id}', '${m.name}')">
      <div class="master-avatar" style="width:100px; height:100px; background:${m.avatarBg}; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 15px; color:white; font-size:40px; font-weight:bold;">
        ${m.name.charAt(0)}
      </div>
      <div class="master-name">${m.name}</div>
      <div class="master-role">${m.spec}</div>
    </div>
  `).join('');
  
  console.log('Мастера загружены, количество:', MASTERS.length);
}

window.selectMaster = (masterId, masterName) => {
  if (!currentUser) {
    alert('Сначала войдите в аккаунт');
    openAuthModal();
    return;
  }
  
  currentMasterId = masterId;
  const master = MASTERS.find(m => m.id === masterId);
  document.getElementById('modalMasterName').innerHTML = master.name;
  
  const servicesDiv = document.getElementById('servicesList');
  servicesDiv.innerHTML = master.services.map(s => `
    <div class="service-item" onclick="selectService(this, '${s.replace(/'/g, "\\'")}')">${s}</div>
  `).join('');
  
  document.getElementById('bookingModal').style.display = 'flex';
};

window.selectService = (el, service) => {
  document.querySelectorAll('.service-item').forEach(i => i.classList.remove('selected'));
  el.classList.add('selected');
  selectedService = service;
};

window.closeModal = () => {
  document.getElementById('bookingModal').style.display = 'none';
  document.getElementById('timeModal').style.display = 'none';
  selectedService = null;
};

async function sendRequest() {
  if (!currentUser) {
    alert('Сначала войдите в аккаунт');
    return;
  }
  if (!selectedService) {
    alert('Выберите услугу');
    return;
  }
  if (!currentMasterId) {
    alert('Выберите мастера');
    return;
  }
  
  const master = MASTERS.find(m => m.id === currentMasterId);
  
  const requestData = {
    masterId: currentMasterId,
    masterName: master.name,
    masterSpec: master.spec,
    clientName: currentUser.email?.split('@')[0] || 'Клиент',
    clientId: currentUser.uid,
    clientEmail: currentUser.email,
    service: selectedService,
    status: 'pending',
    createdAt: new Date().toISOString(),
    proposedTimes: [],
    confirmedTime: null,
    masterRating: null,
    masterReview: null,
    clientRating: null
  };
  
  try {
    await addDoc(collection(db, 'requests'), requestData);
    playSound('notification');
    alert(`Заявка отправлена мастеру ${master.name}`);
    closeModal();
    loadHistory();
  } catch (error) {
    console.error('Ошибка:', error);
    alert('Ошибка: ' + error.message);
  }
}

function listenToMyRequests() {
  if (!currentUser) return;
  
  const q = query(collection(db, 'requests'), where('clientId', '==', currentUser.uid));
  onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      const data = change.doc.data();
      const docId = change.doc.id;
      
      if (data.status === 'waiting_for_time' && data.proposedTimes?.length > 0) {
        currentRequestId = docId;
        showTimeSelection(data.proposedTimes);
        playSound('notification');
        alert(`Мастер ${data.masterName} предложил время для записи`);
      }
      
      if (data.status === 'confirmed' && docId === currentRequestId) {
        playSound('confirm');
        alert(`Запись к ${data.masterName} подтверждена на ${data.confirmedTime}`);
        document.getElementById('timeModal').style.display = 'none';
        loadHistory();
      }
      
      if (data.status === 'completed' && !data.masterRating && docId === currentRequestId) {
        currentRequestId = docId;
        showRatingModal(data.masterName);
        loadHistory();
      }
    });
  });
}

async function loadHistory() {
  if (!currentUser) return;
  
  const q = query(collection(db, 'requests'), where('clientId', '==', currentUser.uid));
  const snapshot = await getDocs(q);
  const requests = [];
  snapshot.forEach(doc => requests.push({ id: doc.id, ...doc.data() }));
  
  const historyContainer = document.getElementById('historyContainer');
  const historySection = document.getElementById('historySection');
  
  if (requests.length === 0) {
    historySection.style.display = 'none';
    return;
  }
  
  historySection.style.display = 'block';
  
  historyContainer.innerHTML = requests.map(req => {
    let statusText = '';
    let statusClass = '';
    switch(req.status) {
      case 'pending': statusText = 'Ожидает ответа мастера'; statusClass = 'status-pending'; break;
      case 'waiting_for_time': statusText = 'Мастер предложил время'; statusClass = 'status-waiting'; break;
      case 'confirmed': statusText = `Подтверждено: ${req.confirmedTime}`; statusClass = 'status-confirmed'; break;
      case 'completed': statusText = 'Завершено'; statusClass = 'status-completed'; break;
      case 'cancelled_by_client': statusText = 'Отменено'; statusClass = 'status-cancelled'; break;
      default: statusText = req.status; statusClass = '';
    }
    
    return `
      <div class="request-card">
        <strong>${req.masterName}</strong> (${req.masterSpec || ''})
        <div>Услуга: ${req.service}</div>
        <div>Дата: ${new Date(req.createdAt).toLocaleString()}</div>
        <span class="status-badge ${statusClass}">${statusText}</span>
        ${req.masterRating ? `<div>Ваша оценка: ${req.masterRating}/5</div>` : ''}
      </div>
    `;
  }).join('');
}

function showTimeSelection(times) {
  const container = document.getElementById('timeOptions');
  container.innerHTML = times.map(time => `
    <div class="time-card" onclick="selectProposedTime(this, '${time}')">${time}</div>
  `).join('');
  document.getElementById('timeModal').style.display = 'flex';
}

window.selectProposedTime = (el, time) => {
  document.querySelectorAll('.time-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedTime = time;
};

async function confirmTime() {
  if (!selectedTime) return alert('Выберите время');
  await updateDoc(doc(db, 'requests', currentRequestId), {
    status: 'confirmed',
    confirmedTime: selectedTime
  });
  playSound('confirm');
}

async function cancelRequest() {
  if (!confirm('Отменить заявку?')) return;
  await updateDoc(doc(db, 'requests', currentRequestId), {
    status: 'cancelled_by_client'
  });
  alert('Заявка отменена');
  document.getElementById('timeModal').style.display = 'none';
}

let selectedRating = 5;

function showRatingModal(masterName) {
  document.getElementById('ratingModal').style.display = 'flex';
  updateStarsDisplay();
}

function updateStarsDisplay() {
  const stars = '★'.repeat(selectedRating) + '☆'.repeat(5 - selectedRating);
  document.getElementById('ratingStars').innerHTML = stars;
}

async function submitRating() {
  const review = document.getElementById('reviewText').value;
  await updateDoc(doc(db, 'requests', currentRequestId), {
    masterRating: selectedRating,
    masterReview: review
  });
  alert(`Спасибо! Вы оценили мастера на ${selectedRating}/5`);
  document.getElementById('ratingModal').style.display = 'none';
  document.getElementById('reviewText').value = '';
}

window.closeRatingModal = () => {
  document.getElementById('ratingModal').style.display = 'none';
};

// Аутентификация
let isLoginMode = true;

function openAuthModal() {
  document.getElementById('authModal').style.display = 'flex';
  updateAuthModal();
}

window.closeAuthModal = () => {
  document.getElementById('authModal').style.display = 'none';
};

function updateAuthModal() {
  const title = document.getElementById('authModalTitle');
  const submitBtn = document.getElementById('authSubmitBtn');
  const switchBtn = document.getElementById('authSwitchBtn');
  const nameField = document.getElementById('authNameField');
  
  if (isLoginMode) {
    title.textContent = 'Вход';
    submitBtn.textContent = 'Войти';
    switchBtn.textContent = 'Нет аккаунта? Зарегистрироваться';
    nameField.style.display = 'none';
  } else {
    title.textContent = 'Регистрация';
    submitBtn.textContent = 'Зарегистрироваться';
    switchBtn.textContent = 'Уже есть аккаунт? Войти';
    nameField.style.display = 'block';
  }
}

document.getElementById('authSubmitBtn').onclick = async () => {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  
  if (!email || !password) {
    alert('Заполните поля');
    return;
  }
  
  try {
    if (isLoginMode) {
      await signInWithEmailAndPassword(auth, email, password);
      alert('Вход выполнен');
    } else {
      await createUserWithEmailAndPassword(auth, email, password);
      alert('Регистрация успешна');
    }
    closeAuthModal();
    clearAuthForm();
  } catch (error) {
    alert('Ошибка: ' + error.message);
  }
};

document.getElementById('authSwitchBtn').onclick = () => {
  isLoginMode = !isLoginMode;
  updateAuthModal();
};

function clearAuthForm() {
  document.getElementById('authEmail').value = '';
  document.getElementById('authPassword').value = '';
  document.getElementById('authName').value = '';
}

document.getElementById('logoutBtn').onclick = async () => {
  await signOut(auth);
  alert('Вы вышли из аккаунта');
};

function updateUIForUser(user) {
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const userNameDisplay = document.getElementById('userNameDisplay');
  const authSection = document.getElementById('authSection');
  
  if (user) {
    currentUser = user;
    loginBtn.style.display = 'none';
    logoutBtn.style.display = 'block';
    userNameDisplay.textContent = user.email?.split('@')[0];
    authSection.style.display = 'block';
    loadMasters();
    listenToMyRequests();
    loadHistory();
  } else {
    currentUser = null;
    loginBtn.style.display = 'block';
    logoutBtn.style.display = 'none';
    userNameDisplay.textContent = '';
    authSection.style.display = 'none';
    document.getElementById('historySection').style.display = 'none';
    document.getElementById('mastersGrid').innerHTML = '';
  }
}

document.getElementById('loginBtn').onclick = openAuthModal;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('sendRequestBtn').onclick = sendRequest;
  document.getElementById('confirmTimeBtn').onclick = confirmTime;
  document.getElementById('cancelTimeBtn').onclick = cancelRequest;
  document.getElementById('submitRatingBtn').onclick = submitRating;
  
  const ratingStars = document.getElementById('ratingStars');
  if (ratingStars) {
    ratingStars.onclick = (e) => {
      const rect = e.target.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const starWidth = rect.width / 5;
      selectedRating = Math.min(5, Math.max(1, Math.ceil(clickX / starWidth)));
      updateStarsDisplay();
    };
  }
});

document.getElementById('g2gisLink').href = 'https://2gis.ru/krasnodar/firm/70000001082652158/tab/reviews/addreview';
document.getElementById('yandexLink').href = 'https://yandex.ru/maps/org/beauty_masters_studio/191730933048/reviews/?add-review=true&ll=38.978331%2C45.102947&tab=reviews&z=16';

onAuthStateChanged(auth, updateUIForUser);