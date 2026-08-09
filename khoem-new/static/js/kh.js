const taskInput = document.getElementById('taskInput');
const addBtn = document.getElementById('addBtn');
const taskList = document.getElementById('taskList');
const filterBtns = document.querySelectorAll('.filter-btn');
const clearCompletedBtn = document.getElementById('clearCompletedBtn');

let currentFilter = 'all';

// ទាញយកទិន្នន័យពី LocalStorage ពេលបើក App
document.addEventListener('DOMContentLoaded', loadTasks);

// បន្ថែម Task
addBtn.addEventListener('click', addTask);

// លុបការងារដែលបានធ្វើរួចទាំងអស់
clearCompletedBtn.addEventListener('click', clearCompletedTasks);

// ចាប់ Event លើ Filter Buttons
filterBtns.forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelector('.filter-btn.active').classList.remove('active');
        this.classList.add('active');

        currentFilter = this.getAttribute('data-filter');
        applyFilter();
    });
});

function addTask() {
    const taskText = taskInput.value.trim();
    
    if (taskText === '') {
        alert('សូមបញ្ចូលឈ្មោះការងារជាមុនសិន!');
        return;
    }

    createTaskElement(taskText, false);
    saveTasks();
    applyFilter();

    taskInput.value = '';
}

function createTaskElement(text, isCompleted) {
    const li = document.createElement('li');
    
    if (isCompleted) {
        li.classList.add('completed');
    }

    li.innerHTML = `
        <span>${text}</span>
        <button class="delete-btn">លុប</button>
    `;

    // គូសសញ្ញារួចរាល់
    li.querySelector('span').addEventListener('click', function() {
        li.classList.toggle('completed');
        saveTasks();
        applyFilter();
    });

    // លុប Task មួយៗ
    li.querySelector('.delete-btn').addEventListener('click', function() {
        li.remove();
        saveTasks();
    });

    taskList.appendChild(li);
}

// មុខងារលុបការងារដែលធ្វើរួចទាំងអស់ (Clear Completed)
function clearCompletedTasks() {
    const completedTasks = taskList.querySelectorAll('li.completed');
    
    if (completedTasks.length === 0) {
        alert('គ្មានការងារដែលបានធ្វើរួចរាល់សម្រាប់លុបទេ!');
        return;
    }

    if (confirm('តើអ្នកប្រាកដថាចង់លុបការងារដែលបានធ្វើរួចរាល់ទាំងអស់មែនទេ?')) {
        completedTasks.forEach(task => task.remove());
        saveTasks();
    }
}

// មុខងារ Filter បង្ហាញ ឬលាក់ Task
function applyFilter() {
    const items = taskList.querySelectorAll('li');

    items.forEach(item => {
        const isCompleted = item.classList.contains('completed');

        switch (currentFilter) {
            case 'all':
                item.style.display = 'flex';
                break;
            case 'active':
                item.style.display = isCompleted ? 'none' : 'flex';
                break;
            case 'completed':
                item.style.display = isCompleted ? 'flex' : 'none';
                break;
        }
    });
}

// រក្សាទុកក្នុង LocalStorage
function saveTasks() {
    const tasks = [];
    const items = taskList.querySelectorAll('li');

    items.forEach(item => {
        tasks.push({
            text: item.querySelector('span').innerText,
            completed: item.classList.contains('completed')
        });
    });

    localStorage.setItem('todoTasks', JSON.stringify(tasks));
}

// ទាញយកពី LocalStorage មកបង្ហាញវិញ
function loadTasks() {
    const savedTasks = JSON.parse(localStorage.getItem('todoTasks')) || [];
    
    savedTasks.forEach(task => {
        createTaskElement(task.text, task.completed);
    });

    applyFilter();
}
