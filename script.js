const STORAGE_KEY = "focusflow_tasks_v2";
const THEME_KEY = "focusflow_theme";

let tasks = loadTasks();
let currentFilter = "all";
let editingId = null;

const $ = (selector) => document.querySelector(selector);

const elements = {
  taskList: $("#taskList"),
  emptyState: $("#emptyState"),
  emptyTitle: $("#emptyTitle"),
  emptyText: $("#emptyText"),
  searchInput: $("#searchInput"),
  sortSelect: $("#sortSelect"),
  modalBackdrop: $("#modalBackdrop"),
  modalTitle: $("#modalTitle"),
  taskForm: $("#taskForm"),
  taskId: $("#taskId"),
  titleInput: $("#titleInput"),
  priorityInput: $("#priorityInput"),
  categoryInput: $("#categoryInput"),
  dueDateInput: $("#dueDateInput"),
  notesInput: $("#notesInput")
};

function todayISO() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[char]));
}

function formatDate(dateString) {
  if (!dateString) return "No due date";
  const date = new Date(`${dateString}T00:00:00`);
  return new Intl.DateTimeFormat("en-IN", { day:"2-digit", month:"short", year:"numeric" }).format(date);
}

function isOverdue(task) {
  return !task.completed && task.dueDate && task.dueDate < todayISO();
}

function priorityValue(priority) {
  return { high: 1, medium: 2, low: 3 }[priority] || 2;
}

function getVisibleTasks() {
  const query = elements.searchInput.value.trim().toLowerCase();

  let result = tasks.filter(task => {
    if (currentFilter === "active") return !task.completed;
    if (currentFilter === "completed") return task.completed;
    return true;
  });

  if (query) {
    result = result.filter(task =>
      `${task.title} ${task.category} ${task.priority} ${task.notes}`.toLowerCase().includes(query)
    );
  }

  switch (elements.sortSelect.value) {
    case "due":
      result.sort((a,b) => (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31"));
      break;
    case "priority":
      result.sort((a,b) => priorityValue(a.priority) - priorityValue(b.priority));
      break;
    case "alphabetical":
      result.sort((a,b) => a.title.localeCompare(b.title));
      break;
    default:
      result.sort((a,b) => b.createdAt - a.createdAt);
  }

  return result;
}

function render() {
  const visible = getVisibleTasks();
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const active = total - completed;
  const percent = total ? Math.round((completed / total) * 100) : 0;

  $("#totalCount").textContent = total;
  $("#activeCount").textContent = active;
  $("#completedCount").textContent = completed;
  $("#productivityCount").textContent = `${percent}%`;

  $("#allBadge").textContent = total;
  $("#activeBadge").textContent = active;
  $("#completedBadge").textContent = completed;

  $("#progressPercent").textContent = `${percent}%`;
  $("#ringNumber").textContent = `${percent}%`;
  $("#progressRing").style.setProperty("--progress", `${percent}%`);
  $("#progressRing").setAttribute("aria-label", `${percent} percent of tasks completed`);
  $("#progressBar").style.width = `${percent}%`;
  $("#progressDone").textContent = completed;
  $("#progressTotal").textContent = total;
  $("#streakCount").textContent = calculateStreak();

  $("#progressMessage").textContent =
    percent === 100 && total ? "Amazing! You completed everything today. 🎉" :
    percent >= 75 ? "You're almost there. Finish strong! 💪" :
    percent >= 50 ? "Great progress. Keep going! ✨" :
    percent > 0 ? "Nice start. One task at a time." :
    "Let's complete your first task.";

  $("#listSummary").textContent = total
    ? `${active} active task${active === 1 ? "" : "s"} • ${completed} completed`
    : "Stay consistent and keep moving.";

  elements.taskList.innerHTML = visible.map(taskHTML).join("");

  const noResults = visible.length === 0;
  elements.emptyState.classList.toggle("hidden", !noResults);
  elements.taskList.classList.toggle("hidden", noResults);

  if (noResults) {
    const hasFilters = Boolean(elements.searchInput.value.trim()) || currentFilter !== "all";
    elements.emptyTitle.textContent = hasFilters ? "No matching tasks" : "No tasks yet";
    elements.emptyText.textContent = hasFilters
      ? "Try another search or filter."
      : "Add your first task and start making progress.";
  }
}

function taskHTML(task) {
  const overdue = isOverdue(task);
  const priorityLabel = { high:"High", medium:"Medium", low:"Low" }[task.priority] || "Medium";

  return `
    <article class="task ${task.completed ? "completed" : ""}" data-id="${task.id}">
      <button class="check ${task.completed ? "completed" : ""}" type="button"
        aria-label="${task.completed ? "Mark task as active" : "Mark task as completed"}"
        data-action="toggle">${task.completed ? "✓" : ""}</button>

      <div>
        <div class="task-title">${escapeHTML(task.title)}</div>
        <div class="task-meta">
          <span class="tag">🏷 ${escapeHTML(task.category)}</span>
          <span class="tag priority-${task.priority}">${priorityLabel}</span>
          <span class="tag ${overdue ? "priority-high" : ""}">📅 ${escapeHTML(formatDate(task.dueDate))}${overdue ? " • Overdue" : ""}</span>
        </div>
        ${task.notes ? `<p class="task-note">💬 ${escapeHTML(task.notes)}</p>` : ""}
      </div>

      <div class="task-actions">
        <button class="small-btn" type="button" data-action="edit" aria-label="Edit ${escapeHTML(task.title)}">✏️</button>
        <button class="small-btn delete" type="button" data-action="delete" aria-label="Delete ${escapeHTML(task.title)}">🗑️</button>
      </div>
    </article>
  `;
}

function openModal(task = null) {
  editingId = task?.id ?? null;
  elements.modalTitle.textContent = task ? "Edit Task" : "Add Task";
  elements.taskId.value = task?.id ?? "";
  elements.titleInput.value = task?.title ?? "";
  elements.priorityInput.value = task?.priority ?? "medium";
  elements.categoryInput.value = task?.category ?? "College";
  elements.dueDateInput.value = task?.dueDate ?? "";
  elements.notesInput.value = task?.notes ?? "";
  elements.modalBackdrop.classList.remove("hidden");
  elements.modalBackdrop.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  setTimeout(() => elements.titleInput.focus(), 50);
}

function closeModal() {
  elements.modalBackdrop.classList.add("hidden");
  elements.modalBackdrop.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  elements.taskForm.reset();
  editingId = null;
}

function addOrUpdateTask(event) {
  event.preventDefault();

  const title = elements.titleInput.value.trim();
  if (!title) {
    showToast("Please enter a task name.");
    return;
  }

  if (editingId) {
    const task = tasks.find(t => t.id === editingId);
    if (!task) return;
    task.title = title;
    task.priority = elements.priorityInput.value;
    task.category = elements.categoryInput.value;
    task.dueDate = elements.dueDateInput.value;
    task.notes = elements.notesInput.value.trim();
    showToast("Task updated successfully.");
  } else {
    tasks.push({
      id: Date.now(),
      title,
      priority: elements.priorityInput.value,
      category: elements.categoryInput.value,
      dueDate: elements.dueDateInput.value,
      notes: elements.notesInput.value.trim(),
      completed: false,
      createdAt: Date.now(),
      completedAt: null
    });
    showToast("Task added successfully.");
  }

  saveTasks();
  closeModal();
  render();
}

function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  task.completedAt = task.completed ? Date.now() : null;
  saveTasks();
  render();
  showToast(task.completed ? "Task completed! 🎉" : "Task marked active.");
}

function deleteTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  if (!confirm(`Delete "${task.title}"?`)) return;
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  render();
  showToast("Task deleted.");
}

function editTask(id) {
  const task = tasks.find(t => t.id === id);
  if (task) openModal(task);
}

function calculateStreak() {
  const days = new Set(
    tasks.filter(t => t.completedAt).map(t => new Date(t.completedAt).toISOString().slice(0,10))
  );
  let streak = 0;
  const cursor = new Date();
  while (true) {
    const key = new Date(cursor.getTime() - cursor.getTimezoneOffset()*60000).toISOString().slice(0,10);
    if (!days.has(key)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  $("#toastContainer").appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}

function toggleTheme() {
  const dark = document.body.classList.toggle("dark");
  localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  $("#themeToggle").textContent = dark ? "☀" : "☾";
  $("#themeToggle").setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
}

function setToday() {
  const now = new Date();
  $("#todayDate").textContent = new Intl.DateTimeFormat("en-IN", {
    weekday:"short", day:"2-digit", month:"short", year:"numeric"
  }).format(now);
}

$("#addTaskBtn").addEventListener("click", () => openModal());
$("#emptyAddBtn").addEventListener("click", () => openModal());
$("#closeModal").addEventListener("click", closeModal);
$("#cancelModal").addEventListener("click", closeModal);
elements.taskForm.addEventListener("submit", addOrUpdateTask);
elements.searchInput.addEventListener("input", render);
elements.sortSelect.addEventListener("change", render);
$("#themeToggle").addEventListener("click", toggleTheme);

document.querySelectorAll(".filter-btn").forEach(button => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    document.querySelectorAll(".filter-btn").forEach(btn => {
      const active = btn === button;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active);
    });
    render();
  });
});

elements.taskList.addEventListener("click", event => {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  const id = Number(actionButton.closest(".task").dataset.id);
  const action = actionButton.dataset.action;
  if (action === "toggle") toggleTask(id);
  if (action === "edit") editTask(id);
  if (action === "delete") deleteTask(id);
});

elements.modalBackdrop.addEventListener("click", event => {
  if (event.target === elements.modalBackdrop) closeModal();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !elements.modalBackdrop.classList.contains("hidden")) closeModal();
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    elements.searchInput.focus();
  }
});

const savedTheme = localStorage.getItem(THEME_KEY);
if (savedTheme === "dark") {
  document.body.classList.add("dark");
  $("#themeToggle").textContent = "☀";
  $("#themeToggle").setAttribute("aria-label", "Switch to light mode");
}

setToday();
render();
