// Load and show saved groups

let saveBtn;
let statusEl;
let groupCountEl;
let tabCountEl;

document.addEventListener("DOMContentLoaded", () => {
  saveBtn = document.getElementById("saveBtn");
  statusEl = document.getElementById("status");
  groupCountEl = document.getElementById("groupCount");
  tabCountEl = document.getElementById("tabCount");

  if (saveBtn) {
    saveBtn.addEventListener("click", onSaveCurrentTabs);
  }

  renderGroups();
});

function setStatus(message = "", tone = "info") {
  if (!statusEl) {
    return;
  }

  statusEl.textContent = message;
  statusEl.className = message ? `status status-${tone}` : "status";
}

function updateSummary(groups) {
  const groupCount = groups.length;
  const tabCount = groups.reduce((total, group) => total + group.urls.length, 0);
  if (groupCountEl) {
    groupCountEl.textContent = `${groupCount} group${groupCount === 1 ? "" : "s"}`;
  }
  if (tabCountEl) {
    tabCountEl.textContent = `${tabCount} tab${tabCount === 1 ? "" : "s"} saved`;
  }
}

function isRestorableUrl(url) {
  return typeof url === "string" && /^(https?:|file:|ftp:)/i.test(url);
}

async function onSaveCurrentTabs() {
  setStatus("");

  try {
    const allTabs = await chrome.tabs.query({ currentWindow: true });
    const urls = allTabs.map((tab) => tab.url).filter(isRestorableUrl);

    if (urls.length === 0) {
      setStatus("No restorable tabs found in this window.", "error");
      return;
    }

    const { tabGroups = [] } = await chrome.storage.local.get("tabGroups");

    const newGroup = {
      id: Date.now(),
      name: `Group ${tabGroups.length + 1} (${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`,
      urls
    };

    tabGroups.push(newGroup);
    await chrome.storage.local.set({ tabGroups });
    setStatus("Tab group saved.", "success");
    renderGroups();
  } catch {
    setStatus("Something went wrong while saving tabs.", "error");
  }
}

function getDisplayHostname(url) {
  try {
    return new URL(url).hostname || url;
  } catch {
    return url;
  }
}

async function getCurrentTabUrl() {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return activeTab?.url;
}

function createTab(url) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url, active: false }, (tab) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(tab);
    });
  });
}

async function renderGroups() {
  const container = document.getElementById("savedGroups");
  if (!container) {
    return;
  }

  const { tabGroups = [] } = await chrome.storage.local.get("tabGroups");
  const normalizedGroups = tabGroups
    .map((group) => ({
      ...group,
      urls: Array.isArray(group.urls) ? group.urls.filter(isRestorableUrl) : []
    }))
    .filter((group) => group.urls.length > 0);

  updateSummary(normalizedGroups);
  container.innerHTML = "";
  container.className = "groups-list";

  if (normalizedGroups.length === 0) {
    container.textContent = "No saved groups yet.";
    container.classList.add("no-groups");
    return;
  }

  normalizedGroups.forEach((group) => {
    const div = document.createElement("div");
    div.className = "group-card";

    const header = document.createElement("div");
    header.className = "group-header";

    const titleWrap = document.createElement("div");
    titleWrap.className = "group-title-wrap";

    const title = document.createElement("span");
    title.className = "group-title";
    title.textContent = group.name;
    titleWrap.appendChild(title);

    const count = document.createElement("span");
    count.className = "group-count";
    count.textContent = `${group.urls.length} tab${group.urls.length === 1 ? "" : "s"}`;
    titleWrap.appendChild(count);

    header.appendChild(titleWrap);

    const actions = document.createElement("div");
    actions.className = "group-actions";

    const addCurrentBtn = document.createElement("button");
    addCurrentBtn.className = "add-tab-btn";
    addCurrentBtn.textContent = "Add Current";
    addCurrentBtn.onclick = async () => {
      try {
        const currentUrl = await getCurrentTabUrl();

        if (!isRestorableUrl(currentUrl)) {
          setStatus("Current tab cannot be added to a group.", "error");
          return;
        }

        if (group.urls.includes(currentUrl)) {
          setStatus("This tab is already in the group.", "warn");
          return;
        }

        const nextGroups = normalizedGroups.map((savedGroup) => {
          if (savedGroup.id !== group.id) {
            return savedGroup;
          }

          return {
            ...savedGroup,
            urls: [...savedGroup.urls, currentUrl]
          };
        });

        await chrome.storage.local.set({ tabGroups: nextGroups });
        setStatus("Current tab added to group.", "success");
        renderGroups();
      } catch {
        setStatus("Failed to add current tab.", "error");
      }
    };
    actions.appendChild(addCurrentBtn);

    const renameBtn = document.createElement("button");
    renameBtn.className = "rename-btn";
    renameBtn.textContent = "Rename";
    renameBtn.onclick = async () => {
      const nextName = prompt("Enter a new group name:", group.name);

      if (nextName === null) {
        return;
      }

      const trimmedName = nextName.trim();

      if (!trimmedName) {
        setStatus("Group name cannot be empty.", "warn");
        return;
      }

      const nextGroups = normalizedGroups.map((savedGroup) => {
        if (savedGroup.id === group.id) {
          return { ...savedGroup, name: trimmedName };
        }

        return savedGroup;
      });

      await chrome.storage.local.set({ tabGroups: nextGroups });
      setStatus("Group renamed.", "success");
      renderGroups();
    };
    actions.appendChild(renameBtn);

    const openBtn = document.createElement("button");
    openBtn.className = "open-btn";
    openBtn.textContent = "Open";
    openBtn.onclick = async () => {
      try {
        const existingTabs = await chrome.tabs.query({});
        const existingUrls = new Set(existingTabs.map((tab) => tab.url).filter(Boolean));
        const uniqueGroupUrls = [...new Set(group.urls)];
        const urlsToOpen = uniqueGroupUrls.filter((url) => !existingUrls.has(url));
        const skippedCount = uniqueGroupUrls.length - urlsToOpen.length;

        if (urlsToOpen.length === 0) {
          setStatus("All tabs in this group are already open.", "info");
          return;
        }

        let openedCount = 0;

        for (const url of urlsToOpen) {
          try {
            await createTab(url);
            openedCount += 1;
          } catch {
          }
        }

        if (openedCount === 0) {
          setStatus("Unable to open tabs from this group.", "error");
          return;
        }

        if (skippedCount > 0) {
          setStatus(
            `Opened ${openedCount} tab${openedCount === 1 ? "" : "s"}. Skipped ${skippedCount} already open.`,
            "success"
          );
          return;
        }

        setStatus(`Opened ${openedCount} tab${openedCount === 1 ? "" : "s"}.`, "success");
      } catch {
        setStatus("Unable to open tabs from this group.", "error");
      }
    };
    actions.appendChild(openBtn);

    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.textContent = "Delete";
    delBtn.onclick = async () => {
      const nextGroups = normalizedGroups.filter((savedGroup) => savedGroup.id !== group.id);
      await chrome.storage.local.set({ tabGroups: nextGroups });
      setStatus("Tab group deleted.", "success");
      renderGroups();
    };
    actions.appendChild(delBtn);

    header.appendChild(actions);
    div.appendChild(header);

    const links = document.createElement("div");
    links.className = "group-links";

    group.urls.forEach((url, urlIndex) => {
      const item = document.createElement("div");
      item.className = "group-link-item";

      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = getDisplayHostname(url);
      item.appendChild(a);

      const removeTabBtn = document.createElement("button");
      removeTabBtn.type = "button";
      removeTabBtn.className = "remove-tab-btn";
      removeTabBtn.textContent = "✕";
      removeTabBtn.title = "Remove tab from this group";
      removeTabBtn.onclick = async () => {
        const nextGroups = normalizedGroups
          .map((savedGroup) => {
            if (savedGroup.id !== group.id) {
              return savedGroup;
            }

            return {
              ...savedGroup,
              urls: savedGroup.urls.filter((_, savedUrlIndex) => savedUrlIndex !== urlIndex)
            };
          })
          .filter((savedGroup) => savedGroup.urls.length > 0);

        await chrome.storage.local.set({ tabGroups: nextGroups });
        setStatus("Tab removed from group.", "success");
        renderGroups();
      };
      item.appendChild(removeTabBtn);

      links.appendChild(item);
    });

    if (group.urls.length === 0) {
      const none = document.createElement("span");
      none.textContent = "No tabs in this group.";
      links.appendChild(none);
    }

    div.appendChild(links);
    container.appendChild(div);
  });
}