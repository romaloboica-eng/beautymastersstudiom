import { db, auth, playSound } from './firebase-config.js';
import { collection, query, where, onSnapshot, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentMasterId = null;
let currentRequestForTimes = null;
let proposedTimesArray = [];
let currentTab = 'new';
let unsubscribe = null;
let flatpickrInstance = null;

const masters = [
  { id: "master1", name: "Анна Иванова" },
  { id: "master2", name: "Елена Петрова" },
  { id: "master3", name: "Мария Сидорова" }
];

function loadMasterSelect() {
  const select = document.getElementById('masterSelect');
  if (!select) {
    console.error('masterSelect не найден');
    return;
  }
  
  select.innerHTML = masters.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
  select.onchange = (e) => {
    currentMasterId = e.target.value;
    console.log('Выбран мастер:', currentMasterId);
    loadRequests();
  };
  currentMasterId = masters[0].id;
  loadRequests();
}

function loadRequests() {
  if (unsubscribe) unsubscribe();
  
  if (!currentMasterId) {
    console.log('Нет выбранного мастера');
    return;
  }
  
  console.log('Загружаем заявки для мастера:', currentMasterId);
  
  const q = query(collection(db, 'requests'), where('masterId', '==', currentMasterId));
  unsubscribe = onSnapshot(q, (snapshot) => {
    const requests = [];
    snapshot.forEach(doc => {
      requests.push({ id: doc.id, ...doc.data() });
    });
    console.log('Получено заявок:', requests.length);
    filterAndDisplayRequests(requests);
    updateTabCounters(requests);
  }, (error) => {
    console.error('Ошибка загрузки:', error);
  });
}

function filterAndDisplayRequests(requests) {
  let filtered = [];
  switch(currentTab) {
    case 'new': 
      filtered = requests.filter(r => r.status === 'pending'); 
      break;
    case 'waiting': 
      filtered = requests.filter(r => r.status === 'waiting_for_time'); 
      break;
    case 'confirmed': 
      filtered = requests.filter(r => r.status === 'confirmed'); 
      break;
    case 'completed': 
      filtered = requests.filter(r => r.status === 'completed'); 
      break;
  }
  
  const container = document.getElementById('requestsContainer');
  if (!container) return;
  
  if (filtered.length === 0) {
    container.innerHTML = '<div style="background:white; border-radius:12px; padding:40px; text-align:center; color:#888;">Нет заявок</div>';
    return;
  }
  
  container.innerHTML = filtered.map(req => `
    <div class="request-card" data-id="${req.id}">
      <div><strong>${req.clientName}</strong></div>
      <div>Услуга: ${req.service}</div>
      <div>Дата заявки: ${req.createdAt ? new Date(req.createdAt).toLocaleString() : 'только что'}</div>
      ${req.confirmedTime ? `<div>Подтверждено: ${req.confirmedTime}</div>` : ''}
      ${req.masterRating ? `<div>Оценка клиента: ${req.masterRating}/5</div>` : ''}
      ${req.clientRating ? `<div>Ваша оценка: ${req.clientRating}/5</div>` : ''}
      <div style="margin-top: 15px;">
        ${getActionButtons(req)}
      </div>
    </div>
  `).join('');
  
  filtered.forEach(req => {
    const card = document.querySelector(`.request-card[data-id="${req.id}"]`);
    if (card) {
      const proposeBtn = card.querySelector('.propose-time-btn');
      if (proposeBtn) proposeBtn.onclick = () => openTimePicker(req.id);
      
      const completeBtn = card.querySelector('.complete-btn');
      if (completeBtn) completeBtn.onclick = () => openClientRating(req.id, req.clientName);
    }
  });
}

function getActionButtons(req) {
  if (req.status === 'pending') {
    return `<button class="propose-time-btn">Предложить время</button>`;
  }
  if (req.status === 'confirmed') {
    return `<button class="complete-btn">Завершить запись</button>`;
  }
  if (req.status === 'completed' && !req.clientRating) {
    return `<span style="color:#27ae60;">Ожидает оценки клиента</span>`;
  }
  if (req.status === 'completed') {
    return `<span style="color:#888;">Завершено</span>`;
  }
  return '';
}

function updateTabCounters(requests) {
  const counts = {
    new: requests.filter(r => r.status === 'pending').length,
    waiting: requests.filter(r => r.status === 'waiting_for_time').length,
    confirmed: requests.filter(r => r.status === 'confirmed').length,
    completed: requests.filter(r => r.status === 'completed').length
  };
  
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const tab = btn.dataset.tab;
    const count = counts[tab];
    const existingBadge = btn.querySelector('.badge');
    if (count > 0) {
      if (existingBadge) {
        existingBadge.textContent = count;
      } else {
        btn.innerHTML += `<span class="badge">${count}</span>`;
      }
    } else {
      if (existingBadge) existingBadge.remove();
    }
  });
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTab = btn.dataset.tab;
    loadRequests();
  };
});

function openTimePicker(requestId) {
  currentRequestForTimes = requestId;
  proposedTimesArray = [];
  document.getElementById('selectedTimesList').innerHTML = '';
  document.getElementById('timePickerModal').style.display = 'flex';
  
  setTimeout(() => {
    if (flatpickrInstance) flatpickrInstance.destroy();
    flatpickrInstance = flatpickr("#datetimePicker", {
      enableTime: true,
      dateFormat: "Y-m-d H:i",
      time_24hr: true,
      minuteIncrement: 15,
      locale: "ru"
    });
  }, 100);
}

document.getElementById('addTimeBtn').onclick = () => {
  const timePicker = document.getElementById('datetimePicker');
  if (!timePicker) return;
  const time = timePicker.value;
  if (!time) {
    alert('Выберите дату и время');
    return;
  }
  if (proposedTimesArray.includes(time)) {
    alert('Это время уже добавлено');
    return;
  }
  
  proposedTimesArray.push(time);
  const list = document.getElementById('selectedTimesList');
  list.innerHTML = proposedTimesArray.map(t => `
    <div class="time-card" style="display:flex; justify-content:space-between; align-items:center;">
      <span>${t}</span>
      <button onclick="removeTime('${t}')" style="margin:0; padding:5px 10px;">Удалить</button>
    </div>
  `).join('');
  timePicker.value = '';
};

window.removeTime = (time) => {
  proposedTimesArray = proposedTimesArray.filter(t => t !== time);
  const list = document.getElementById('selectedTimesList');
  list.innerHTML = proposedTimesArray.map(t => `
    <div class="time-card" style="display:flex; justify-content:space-between; align-items:center;">
      <span>${t}</span>
      <button onclick="removeTime('${t}')" style="margin:0; padding:5px 10px;">Удалить</button>
    </div>
  `).join('');
};

document.getElementById('sendTimesBtn').onclick = async () => {
  if (proposedTimesArray.length === 0) {
    alert('Добавьте хотя бы одно время');
    return;
  }
  
  try {
    await updateDoc(doc(db, 'requests', currentRequestForTimes), {
      status: 'waiting_for_time',
      proposedTimes: proposedTimesArray
    });
    playSound('notification');
    alert('Время отправлено клиенту');
    closeTimePickerModal();
  } catch (error) {
    console.error('Ошибка отправки времени:', error);
    alert('Ошибка при отправке');
  }
};

window.closeTimePickerModal = () => {
  document.getElementById('timePickerModal').style.display = 'none';
  if (flatpickrInstance) {
    flatpickrInstance.destroy();
    flatpickrInstance = null;
  }
};

let currentCompleteRequestId = null;

window.openClientRating = (requestId, clientName) => {
  currentCompleteRequestId = requestId;
  document.getElementById('clientRatingModal').style.display = 'flex';
};

window.rateClient = async (rating) => {
  try {
    await updateDoc(doc(db, 'requests', currentCompleteRequestId), {
      status: 'completed',
      clientRating: rating,
      completedAt: new Date().toISOString()
    });
    playSound('complete');
    alert(`Запись завершена! Оценка клиенту: ${rating}/5`);
    closeClientRatingModal();
  } catch (error) {
    console.error('Ошибка завершения:', error);
    alert('Ошибка при завершении');
  }
};

window.closeClientRatingModal = () => {
  document.getElementById('clientRatingModal').style.display = 'none';
  currentCompleteRequestId = null;
};

auth.onAuthStateChanged((user) => {
  console.log('Auth состояние мастера:', user);
  loadMasterSelect();
});