"use strict";

// ===== Supabase接続設定 =====
// ここには接続テストに成功した値を貼り付けた

const SUPABASE_URL = "https://kdvcosjnzahoqhvnnwvh.supabase.co";

const SUPABASE_KEY = "sb_publishable_r_BWYdlDaUroNHALvajcRw_e6ZsXWmU";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// ===== HTMLの部品を取得 =====
const participantList = document.getElementById("participantList");
const totalCount = document.getElementById("totalCount");
const attendingCount = document.getElementById("attendingCount");
const absentCount = document.getElementById("absentCount");
const addButton = document.getElementById("addButton");
const printButton = document.getElementById("printButton");
const saveMessage = document.getElementById("saveMessage");

// ===== 参加者データ =====
let participants = [];
let isLoading = false;
let isSaving = false;
let isEditing = false;
let pendingSaves = 0;
let lastEditTime = 0;
const saveTimers = new Map();

// ===== メッセージ表示 =====
function showMessage(message) {
  saveMessage.textContent = message;
}

// ===== Supabaseから読み込み =====
async function loadParticipants() {
  if (isLoading || isSaving || isEditing || pendingSaves > 0) {
    return;
  }

  isLoading = true;

  try {
    const { data, error } = await supabaseClient
      .from("participants")
      .select("id, nickname, comment, is_absent")
      .order("id", { ascending: true });

    if (error) throw error;

    // 読み込み中に編集が始まった場合は画面を更新しない
    if (isEditing || isSaving || pendingSaves > 0) return;

    participants = data.map((person) => ({
      id: person.id,
      nickname: person.nickname ?? "",
      comment: person.comment ?? "",
      absent: person.is_absent === true
    }));

    renderParticipants();
  } catch (error) {
    console.error("読み込みエラー:", error);
    showMessage("参加者一覧を読み込めませんでした。");
  } finally {
    isLoading = false;
  }
}

// ===== Supabaseへ保存 =====
async function saveParticipant(person) {
  pendingSaves++;

  try {
    showMessage("保存中...");

    const { error } = await supabaseClient
      .from("participants")
      .update({
        nickname: person.nickname,
        comment: person.comment,
        is_absent: person.absent
      })
      .eq("id", person.id);

    if (error) throw error;

    showMessage("✓ Supabaseに保存しました。");
  } catch (error) {
    console.error("保存エラー:", error);
    showMessage("保存に失敗しました。再度入力してください。");
  } finally {
    pendingSaves--;
  }
}

// ===== 入力後に少し待って保存 =====
function scheduleSave(person) {
  lastEditTime = Date.now();

  clearTimeout(saveTimers.get(person.id));

  const timer = setTimeout(() => {
    saveTimers.delete(person.id);
    saveParticipant(person);
  }, 700);

  saveTimers.set(person.id, timer);
}

// ===== 一覧表示 =====
function renderParticipants() {
  participantList.replaceChildren();

  participants.forEach((person, index) => {
    const row = document.createElement("tr");

    if (person.absent) {
      row.classList.add("is-absent");
    }

    // 番号
    const numberCell = document.createElement("td");
    numberCell.className = "number-column";
    numberCell.textContent = index + 1;
    row.appendChild(numberCell);

    // ニックネーム
    const nameCell = document.createElement("td");
    nameCell.className = "name-cell";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "name-input";
    nameInput.placeholder = "ニックネームを入力";
    nameInput.value = person.nickname;

    nameInput.addEventListener("focus", () => {
      isEditing = true;
    });

    nameInput.addEventListener("blur", () => {
      isEditing = false;
    });

    nameInput.addEventListener("input", () => {
      person.nickname = nameInput.value;
      updateCounts();
      scheduleSave(person);
    });

    const absentLabel = document.createElement("span");
    absentLabel.className = "absent-label";
    absentLabel.textContent = "不参加";

    nameCell.append(nameInput, absentLabel);
    row.appendChild(nameCell);

    // コメント
    const commentCell = document.createElement("td");

    const commentInput = document.createElement("input");
    commentInput.type = "text";
    commentInput.className = "comment-input";
    commentInput.placeholder = "コメントを入力";
    commentInput.value = person.comment;

    commentInput.addEventListener("focus", () => {
      isEditing = true;
    });

    commentInput.addEventListener("blur", () => {
      isEditing = false;
    });

    commentInput.addEventListener("input", () => {
      person.comment = commentInput.value;
      scheduleSave(person);
    });

    commentCell.appendChild(commentInput);
    row.appendChild(commentCell);

    // 不参加チェック
    const checkCell = document.createElement("td");
    checkCell.className = "check-column";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "absent-checkbox";
    checkbox.checked = person.absent;

    checkbox.addEventListener("change", () => {
      person.absent = checkbox.checked;
      row.classList.toggle("is-absent", person.absent);
      updateCounts();
      scheduleSave(person);
    });

    checkCell.appendChild(checkbox);
    row.appendChild(checkCell);

    // 削除
    const deleteCell = document.createElement("td");
    deleteCell.className = "delete-column";

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.textContent = "削除";

    deleteButton.addEventListener("click", async () => {
      const confirmed = window.confirm(
        `${index + 1}番の参加者欄を削除しますか？`
      );

      if (!confirmed) return;

      clearTimeout(saveTimers.get(person.id));
      saveTimers.delete(person.id);

      try {
        const { error } = await supabaseClient
          .from("participants")
          .delete()
          .eq("id", person.id);

        if (error) throw error;

        participants = participants.filter(
          (item) => item.id !== person.id
        );

        renderParticipants();
        showMessage("✓ 削除しました。");
      } catch (error) {
        console.error("削除エラー:", error);
        showMessage("削除に失敗しました。");
      }
    });

    deleteCell.appendChild(deleteButton);
    row.appendChild(deleteCell);

    participantList.appendChild(row);
  });

  updateCounts();
}

// ===== 人数集計 =====
function updateCounts() {
  const registered = participants.filter(
    (person) => person.nickname.trim() !== ""
  );

  totalCount.textContent = registered.length;

  attendingCount.textContent = registered.filter(
    (person) => !person.absent
  ).length;

  absentCount.textContent = registered.filter(
    (person) => person.absent
  ).length;
}

// ===== 行を追加 =====
addButton.addEventListener("click", async () => {
  addButton.disabled = true;

  try {
    const { data, error } = await supabaseClient
      .from("participants")
      .insert({
        nickname: "",
        comment: "",
        is_absent: false
      })
      .select("id, nickname, comment, is_absent")
      .single();

    if (error) throw error;

    participants.push({
      id: data.id,
      nickname: data.nickname ?? "",
      comment: data.comment ?? "",
      absent: data.is_absent === true
    });

    renderParticipants();
    showMessage("✓ 新しい行を追加しました。");
  } catch (error) {
    console.error("追加エラー:", error);
    showMessage("行の追加に失敗しました。");
  } finally {
    addButton.disabled = false;
  }
});

// ===== 印刷 =====
printButton.addEventListener("click", () => {
  window.print();
});

// ===== 最初の読み込み =====
loadParticipants();

// ===== 定期的に最新情報を取得 =====
setInterval(() => {
  if (
    !isEditing &&
    !isSaving &&
    pendingSaves === 0 &&
    saveTimers.size === 0 &&
    Date.now() - lastEditTime > 3000
  ) {
    loadParticipants();
  }
}, 5000);
