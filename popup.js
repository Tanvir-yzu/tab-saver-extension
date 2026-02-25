// Load and show saved groups

document.addEventListener("DOMContentLoaded", renderGroups);

const saveBtn = document.getElementById("saveBtn");
const statusEl = document.getElementById("status");

function setStatus(message = "") {
  statusEl.textContent = message;
}

function isRestorableUrl(url) {
  return typeof url === "string" && /^(https?:|file:|ftp:)/i.test(url);
}

saveBtn.addEventListener("click", async () => {
  setStatus("");

  try {
    const allTabs = await chrome.tabs.query({ currentWindow: true });
    const urls = allTabs.map((tab) => tab.url).filter(isRestorableUrl);

    if (urls.length === 0) {
      setStatus("No restorable tabs found in this window.");
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
    setStatus("Tab group saved.");
    renderGroups();
  } catch {
    setStatus("Something went wrong while saving tabs.");
  }
});

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

async function renderGroups() {
  const container = document.getElementById("savedGroups");
  const { tabGroups = [] } = await chrome.storage.local.get("tabGroups");
  const normalizedGroups = tabGroups
    .map((group) => ({
      ...group,
      urls: Array.isArray(group.urls) ? group.urls.filter(isRestorableUrl) : []
    }))
    .filter((group) => group.urls.length > 0);

  container.innerHTML = "";

  if (normalizedGroups.length === 0) {
    container.textContent = "No saved groups yet.";
    container.className = "no-groups";
    return;
  }

  container.className = "";

  normalizedGroups.forEach((group) => {
    const div = document.createElement("div");
    div.className = "group-card";

    const header = document.createElement("div");
    header.className = "group-header";

    const title = document.createElement("span");
    title.className = "group-title";
    title.textContent = group.name;
    header.appendChild(title);

    const actions = document.createElement("div");
    actions.className = "group-actions";

    const addCurrentBtn = document.createElement("button");
    addCurrentBtn.className = "add-tab-btn";
    addCurrentBtn.textContent = "Add Current";
    addCurrentBtn.onclick = async () => {
      try {
        const currentUrl = await getCurrentTabUrl();

        if (!isRestorableUrl(currentUrl)) {
          setStatus("Current tab cannot be added to a group.");
          return;
        }

        if (group.urls.includes(currentUrl)) {
          setStatus("This tab is already in the group.");
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
        setStatus("Current tab added to group.");
        renderGroups();
      } catch {
        setStatus("Failed to add current tab.");
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
        setStatus("Group name cannot be empty.");
        return;
      }

      const nextGroups = normalizedGroups.map((savedGroup) => {
        if (savedGroup.id === group.id) {
          return { ...savedGroup, name: trimmedName };
        }

        return savedGroup;
      });

      await chrome.storage.local.set({ tabGroups: nextGroups });
      setStatus("Group renamed.");
      renderGroups();
    };
    actions.appendChild(renameBtn);

    const openBtn = document.createElement("button");
    openBtn.className = "open-btn";
    openBtn.textContent = "Open";
    openBtn.onclick = async () => {
      let openedCount = 0;

      group.urls.forEach((url) => {
        chrome.tabs.create({ url, active: false }, () => {
          if (!chrome.runtime.lastError) {
            openedCount += 1;
          }
        });
      });

      setTimeout(() => {
        if (openedCount > 0) {
          setStatus(`Opened ${openedCount} tab${openedCount === 1 ? "" : "s"}.`);
        } else {
          setStatus("Unable to open tabs from this group.");
        }
      }, 120);
    };
    actions.appendChild(openBtn);

    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.textContent = "Delete";
    delBtn.onclick = async () => {
      const nextGroups = normalizedGroups.filter((savedGroup) => savedGroup.id !== group.id);
      await chrome.storage.local.set({ tabGroups: nextGroups });
      setStatus("Tab group deleted.");
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
        setStatus("Tab removed from group.");
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