/*
 * KHOEM_AI additive client module
 * --------------------------------
 * This file is intentionally independent from the legacy inline script.
 * It does not claim existing IDs, route names, or global function names.
 *
 * Optional usage:
 *   window.KhoemAI.chat("session_id", "សួស្តី")
 *   window.KhoemAI.music({ sessionId, prompt: "..." })
 *
 * When static/js/api-client.js is already loaded, this module reuses
 * window.KhoemAPI so the existing API-key and error behavior is preserved.
 */
(function (window, document) {
  "use strict";

  var existing = window.KhoemAI;
  var api = existing && typeof existing === "object" ? existing : {};
  var apiBase = "";

  function getStoredApiKey() {
    try {
      return window.localStorage.getItem("khoem_api_key") || "";
    } catch (error) {
      return "";
    }
  }

  function buildHeaders(extraHeaders) {
    var headers = Object.assign(
      { "Content-Type": "application/json" },
      extraHeaders || {}
    );
    var key = getStoredApiKey();
    if (key && !headers["X-API-Key"]) {
      headers["X-API-Key"] = key;
    }
    return headers;
  }

  function parseResponse(response) {
    return response.text().then(function (text) {
      var data = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (error) {
          data = { error: "Server returned an invalid JSON response." };
        }
      }

      if (!response.ok) {
        var requestError = new Error(
          data.error || "The API request was not successful."
        );
        requestError.status = response.status;
        requestError.payload = data;
        throw requestError;
      }
      return data;
    });
  }

  function request(path, options) {
    var config = options || {};
    var method = config.method || "GET";
    var body = config.body;
    var headers = buildHeaders(config.headers);

    /*
     * Reuse the old client when available. This avoids creating a second
     * API-key implementation beside static/js/api-client.js.
     */
    if (window.KhoemAPI) {
      if (method === "GET" && typeof window.KhoemAPI.get === "function") {
        return window.KhoemAPI.get(path);
      }
      if (method === "POST" && typeof window.KhoemAPI.post === "function") {
        var parsedBody = body;
        if (typeof body === "string") {
          try {
            parsedBody = JSON.parse(body);
          } catch (error) {
            parsedBody = body;
          }
        }
        return window.KhoemAPI.post(path, parsedBody);
      }
    }

    var fetchOptions = {
      method: method,
      headers: headers,
    };
    if (body !== undefined && body !== null) {
      fetchOptions.body =
        typeof body === "string" ? body : JSON.stringify(body);
    }
    return window.fetch(apiBase + path, fetchOptions).then(parseResponse);
  }

  function requireValue(value, fieldName) {
    if (value === undefined || value === null || String(value).trim() === "") {
      var error = new Error(fieldName + " is required.");
      error.code = "missing_field";
      throw error;
    }
    return value;
  }

  function emit(name, detail) {
    if (typeof window.CustomEvent !== "function") return;
    window.dispatchEvent(new window.CustomEvent(name, { detail: detail }));
  }

  function run(name, callback) {
    return Promise.resolve()
      .then(callback)
      .then(function (result) {
        emit("khoem-ai:success", { operation: name, result: result });
        return result;
      })
      .catch(function (error) {
        emit("khoem-ai:error", { operation: name, error: error });
        throw error;
      });
  }

  api.configure = function (options) {
    var config = options || {};
    apiBase = typeof config.baseUrl === "string" ? config.baseUrl : "";
    return api;
  };

  api.request = request;

  function createId(prefix) {
    var randomPart =
      window.crypto && typeof window.crypto.randomUUID === "function"
        ? window.crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2);
    return (prefix || "item") + "_" + randomPart;
  }

  function normalizedSessionId(sessionId) {
    requireValue(sessionId, "session_id");
    return String(sessionId).trim();
  }

  api.chat = function (sessionId, message, options) {
    return run("chat", function () {
      requireValue(sessionId, "session_id");
      requireValue(message, "message");
      var payload = {
        session_id: String(sessionId).trim(),
        message: String(message).trim(),
      };
      if (options && options.systemPrompt) {
        payload.system_prompt = options.systemPrompt;
      }
      return request("/api/chat", {
        method: "POST",
        body: payload,
      });
    });
  };

  api.vision = function (imageBase64, question, mimeType) {
    return run("vision", function () {
      requireValue(imageBase64, "image");
      return request("/api/vision", {
        method: "POST",
        body: {
          image: imageBase64,
          question: question || "សូមពិពណ៌នារូបភាពនេះជាភាសាខ្មែរ",
          mime_type: mimeType || "image/jpeg",
        },
      });
    });
  };

  api.music = function (options) {
    var config = options || {};
    return run("music", function () {
      requireValue(config.sessionId, "session_id");
      requireValue(config.prompt, "prompt");
      return request("/api/music/generate", {
        method: "POST",
        body: {
          session_id: String(config.sessionId).trim(),
          prompt: String(config.prompt).trim(),
          style: config.style || "",
          duration: config.duration === undefined ? 30 : config.duration,
          instrumental: Boolean(config.instrumental),
        },
      });
    });
  };

  api.videoWithMusic = function (options) {
    var config = options || {};
    return run("video-with-music", function () {
      requireValue(config.sessionId, "session_id");
      requireValue(config.videoPrompt, "video_prompt");
      return request("/api/video/generate-with-music", {
        method: "POST",
        body: {
          session_id: String(config.sessionId).trim(),
          video_prompt: String(config.videoPrompt).trim(),
          music_prompt: String(config.musicPrompt || config.videoPrompt).trim(),
          duration: config.duration === undefined ? 10 : config.duration,
          resolution: config.resolution || "720p",
          style: config.style || "cinematic",
          fps: config.fps === undefined ? 24 : config.fps,
          quality: config.quality || "standard",
          instrumental: Boolean(config.instrumental),
        },
      });
    });
  };

  api.directions = function (origin, destination, mode) {
    return run("directions", function () {
      requireValue(origin, "origin");
      requireValue(destination, "destination");
      return request("/api/directions", {
        method: "POST",
        body: {
          origin: origin,
          destination: destination,
          mode: mode || "driving",
        },
      });
    });
  };

  api.places = {
    list: function (sessionId) {
      return run("places:list", function () {
        requireValue(sessionId, "session_id");
        return request(
          "/api/places/" + encodeURIComponent(String(sessionId).trim())
        );
      });
    },
    find: function (sessionId, label) {
      return run("places:find", function () {
        requireValue(sessionId, "session_id");
        requireValue(label, "label");
        return request(
          "/api/places/" +
            encodeURIComponent(String(sessionId).trim()) +
            "/" +
            encodeURIComponent(String(label).trim())
        );
      });
    },
    save: function (sessionId, label, latitude, longitude) {
      return run("places:save", function () {
        requireValue(sessionId, "session_id");
        requireValue(label, "label");
        return request("/api/places", {
          method: "POST",
          body: {
            session_id: String(sessionId).trim(),
            label: String(label).trim(),
            lat: latitude,
            lng: longitude,
          },
        });
      });
    },
    remove: function (sessionId, label) {
      return run("places:remove", function () {
        requireValue(sessionId, "session_id");
        requireValue(label, "label");
        return request(
          "/api/places/" +
            encodeURIComponent(String(sessionId).trim()) +
            "/" +
            encodeURIComponent(String(label).trim()),
          { method: "DELETE" }
        );
      });
    },
  };

  api.history = {
    list: function (sessionId, limit) {
      return run("history:list", function () {
        var id = normalizedSessionId(sessionId);
        var safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
        return request(
          "/api/history/" + encodeURIComponent(id) + "?limit=" + safeLimit
        );
      });
    },
    clear: function (sessionId) {
      return run("history:clear", function () {
        var id = normalizedSessionId(sessionId);
        return request("/api/history/" + encodeURIComponent(id), {
          method: "DELETE",
        });
      });
    },
  };

  function memoryStorageKey(sessionId) {
    return "khoem_ai_memory:" + normalizedSessionId(sessionId);
  }

  function readMemory(sessionId) {
    try {
      var raw = window.localStorage.getItem(memoryStorageKey(sessionId));
      var entries = raw ? JSON.parse(raw) : [];
      return Array.isArray(entries) ? entries : [];
    } catch (error) {
      return [];
    }
  }

  function writeMemory(sessionId, entries) {
    try {
      window.localStorage.setItem(
        memoryStorageKey(sessionId),
        JSON.stringify(entries.slice(0, 200))
      );
    } catch (error) {
      var storageError = new Error(
        "Browser memory cannot be saved. Local storage may be full or disabled."
      );
      storageError.code = "memory_storage_unavailable";
      throw storageError;
    }
  }

  api.memory = {
    list: function (sessionId, searchTerm) {
      var query = String(searchTerm || "").trim().toLocaleLowerCase();
      return readMemory(sessionId).filter(function (entry) {
        return !query || String(entry.text).toLocaleLowerCase().includes(query);
      });
    },
    save: function (sessionId, text, source) {
      var id = normalizedSessionId(sessionId);
      var content = String(requireValue(text, "text")).trim();
      if (content.length > 4000) {
        content = content.slice(0, 4000);
      }
      var entry = {
        id: createId("memory"),
        text: content,
        source: source || "manual",
        created_at: new Date().toISOString(),
      };
      var entries = readMemory(id);
      entries.unshift(entry);
      writeMemory(id, entries);
      emit("khoem-ai:memory-saved", { sessionId: id, entry: entry });
      return entry;
    },
    remove: function (sessionId, memoryId) {
      var id = normalizedSessionId(sessionId);
      var remaining = readMemory(id).filter(function (entry) {
        return entry.id !== memoryId;
      });
      writeMemory(id, remaining);
      emit("khoem-ai:memory-removed", { sessionId: id, memoryId: memoryId });
      return remaining;
    },
    clear: function (sessionId) {
      var id = normalizedSessionId(sessionId);
      writeMemory(id, []);
      emit("khoem-ai:memory-cleared", { sessionId: id });
      return [];
    },
    export: function (sessionId) {
      var id = normalizedSessionId(sessionId);
      return {
        session_id: id,
        exported_at: new Date().toISOString(),
        memories: readMemory(id),
      };
    },
  };

  api.toBase64 = function (file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error("A file is required."));
        return;
      }
      var reader = new window.FileReader();
      reader.onload = function () {
        resolve(String(reader.result).split(",")[1] || "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  function getHostSessionId() {
    var sessionLabel = document.getElementById("session-label");
    if (sessionLabel && sessionLabel.textContent.trim()) {
      return "session_" + sessionLabel.textContent.trim().toLowerCase();
    }

    try {
      var stored = window.sessionStorage.getItem("khoem_ai_session_id");
      if (stored) return stored;
      var generated = createId("session");
      window.sessionStorage.setItem("khoem_ai_session_id", generated);
      return generated;
    } catch (error) {
      return createId("session");
    }
  }

  function downloadJson(filename, payload) {
    var blob = new window.Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    var link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    window.setTimeout(function () {
      window.URL.revokeObjectURL(link.href);
    }, 500);
  }

  function createMemoryTools() {
    if (window.KhoemAI && window.KhoemAI.disableAutoTools) return;
    if (document.querySelector(".ai-memory-launcher")) return;

    var sessionId = getHostSessionId();
    var launcher = document.createElement("button");
    launcher.type = "button";
    launcher.className = "ai-memory-launcher";
    launcher.setAttribute("aria-label", "បើក AI memory center");
    launcher.textContent = "Memory";

    var panel = document.createElement("aside");
    panel.className = "ai-memory-panel";
    panel.setAttribute("aria-label", "AI chat history and memory");
    panel.innerHTML =
      '<div class="ai-memory-panel__header">' +
      '<div><span class="ai-panel__subtitle">KHOEM_AI TOOLS</span>' +
      '<h2 class="ai-panel__title">Chat history &amp; memory</h2></div>' +
      '<button type="button" class="ai-memory-panel__close" aria-label="បិទ">×</button>' +
      "</div>" +
      '<div class="ai-memory-panel__session">Session: <b></b></div>' +
      '<div class="ai-memory-panel__tabs" role="tablist">' +
      '<button type="button" class="ai-memory-tab is-active" data-ai-memory-tab="history">History</button>' +
      '<button type="button" class="ai-memory-tab" data-ai-memory-tab="memory">Memory</button>' +
      "</div>" +
      '<section class="ai-memory-view is-active" data-ai-memory-view="history">' +
      '<div class="ai-memory-actions">' +
      '<button type="button" class="ai-button ai-button--primary" data-ai-history-refresh>Refresh</button>' +
      '<button type="button" class="ai-button" data-ai-history-export>Export</button>' +
      '<button type="button" class="ai-button ai-button--danger" data-ai-history-clear>Clear server</button>' +
      "</div>" +
      '<div class="ai-memory-list" data-ai-history-list><p class="ai-memory-empty">ចុច Refresh ដើម្បីទាញប្រវត្តិ chat។</p></div>' +
      "</section>" +
      '<section class="ai-memory-view" data-ai-memory-view="memory">' +
      '<textarea class="ai-memory-input" data-ai-memory-input maxlength="4000" placeholder="សរសេរចំណុចសំខាន់ដែល KHOEM_AI គួរចងចាំ..."></textarea>' +
      '<div class="ai-memory-actions">' +
      '<button type="button" class="ai-button ai-button--primary" data-ai-memory-save>Save memory</button>' +
      '<button type="button" class="ai-button" data-ai-memory-chat-save>Save visible chat</button>' +
      '<button type="button" class="ai-button" data-ai-memory-export>Export</button>' +
      "</div>" +
      '<input class="ai-memory-search" data-ai-memory-search type="search" placeholder="ស្វែងរក memory..." />' +
      '<div class="ai-memory-list" data-ai-memory-list></div>' +
      "</section>" +
      '<p class="ai-memory-feedback" data-ai-memory-feedback role="status"></p>';

    document.body.appendChild(launcher);
    document.body.appendChild(panel);

    var panelSession = panel.querySelector(".ai-memory-panel__session b");
    var feedback = panel.querySelector("[data-ai-memory-feedback]");
    var historyList = panel.querySelector("[data-ai-history-list]");
    var memoryList = panel.querySelector("[data-ai-memory-list]");
    var memoryInput = panel.querySelector("[data-ai-memory-input]");
    var memorySearch = panel.querySelector("[data-ai-memory-search]");
    panelSession.textContent = sessionId.replace(/^session_/, "").toUpperCase();

    function notify(message, isError) {
      feedback.textContent = message || "";
      feedback.classList.toggle("is-error", Boolean(isError));
    }

    function formatDate(value) {
      if (!value) return "";
      var date = new Date(value);
      return Number.isNaN(date.getTime())
        ? ""
        : date.toLocaleString("km-KH", { dateStyle: "short", timeStyle: "short" });
    }

    function renderHistory(messages) {
      historyList.innerHTML = "";
      if (!messages.length) {
        historyList.innerHTML =
          '<p class="ai-memory-empty">មិនទាន់មានប្រវត្តិ chat សម្រាប់ session នេះទេ។</p>';
        return;
      }
      messages.forEach(function (message) {
        var item = document.createElement("article");
        item.className = "ai-history-item";
        var label = document.createElement("span");
        label.className = "ai-memory-item__meta";
        label.textContent = message.role + " · server history";
        var text = document.createElement("p");
        text.textContent = message.content || "";
        item.append(label, text);
        historyList.appendChild(item);
      });
    }

    function renderMemory() {
      var entries = api.memory.list(sessionId, memorySearch.value);
      memoryList.innerHTML = "";
      if (!entries.length) {
        memoryList.innerHTML =
          '<p class="ai-memory-empty">មិនទាន់មាន memory។</p>';
        return;
      }
      entries.forEach(function (entry) {
        var item = document.createElement("article");
        item.className = "ai-memory-item";
        var meta = document.createElement("span");
        meta.className = "ai-memory-item__meta";
        meta.textContent = (entry.source || "manual") + " · " + formatDate(entry.created_at);
        var text = document.createElement("p");
        text.textContent = entry.text;
        var remove = document.createElement("button");
        remove.type = "button";
        remove.className = "ai-memory-item__remove";
        remove.setAttribute("aria-label", "លុប memory");
        remove.textContent = "×";
        remove.addEventListener("click", function () {
          api.memory.remove(sessionId, entry.id);
          renderMemory();
          notify("Memory ត្រូវបានលុប។");
        });
        item.append(meta, remove, text);
        memoryList.appendChild(item);
      });
    }

    function visibleChatText() {
      var messages = document.querySelectorAll("#chat-box .msg");
      return Array.prototype.map
        .call(messages, function (message) {
          return message.textContent.replace(/\s+/g, " ").trim();
        })
        .filter(Boolean)
        .join("\n");
    }

    function showView(viewName) {
      Array.prototype.forEach.call(
        panel.querySelectorAll("[data-ai-memory-tab]"),
        function (tab) {
          tab.classList.toggle(
            "is-active",
            tab.getAttribute("data-ai-memory-tab") === viewName
          );
        }
      );
      Array.prototype.forEach.call(
        panel.querySelectorAll("[data-ai-memory-view]"),
        function (view) {
          view.classList.toggle(
            "is-active",
            view.getAttribute("data-ai-memory-view") === viewName
          );
        }
      );
      if (viewName === "memory") renderMemory();
    }

    launcher.addEventListener("click", function () {
      panel.classList.add("is-open");
      launcher.classList.add("is-hidden");
      renderMemory();
    });
    panel.querySelector(".ai-memory-panel__close").addEventListener("click", function () {
      panel.classList.remove("is-open");
      launcher.classList.remove("is-hidden");
    });
    Array.prototype.forEach.call(
      panel.querySelectorAll("[data-ai-memory-tab]"),
      function (tab) {
        tab.addEventListener("click", function () {
          showView(tab.getAttribute("data-ai-memory-tab"));
        });
      }
    );
    panel.querySelector("[data-ai-history-refresh]").addEventListener("click", function () {
      notify("កំពុងទាញប្រវត្តិ...");
      api.history
        .list(sessionId)
        .then(function (data) {
          renderHistory(Array.isArray(data.messages) ? data.messages : []);
          notify("ប្រវត្តិ chat បាន update។");
        })
        .catch(function () {
          notify("មិនអាចទាញប្រវត្តិពី server បានទេ។", true);
        });
    });
    panel.querySelector("[data-ai-history-export]").addEventListener("click", function () {
      api.history
        .list(sessionId)
        .then(function (data) {
          downloadJson("khoem-ai-history.json", data);
          notify("History បាន export។");
        })
        .catch(function () {
          notify("Export history បរាជ័យ។", true);
        });
    });
    panel.querySelector("[data-ai-history-clear]").addEventListener("click", function () {
      if (!window.confirm("តើបងប្រាកដថាចង់លុប chat history របស់ session នេះមែនទេ?")) return;
      api.history
        .clear(sessionId)
        .then(function () {
          renderHistory([]);
          notify("Server history ត្រូវបានលុប។");
        })
        .catch(function () {
          notify("មិនអាចលុប server history បានទេ។", true);
        });
    });
    panel.querySelector("[data-ai-memory-save]").addEventListener("click", function () {
      var text = memoryInput.value.trim();
      if (!text) {
        notify("សូមសរសេរ memory មុនសិន។", true);
        return;
      }
      api.memory.save(sessionId, text, "manual");
      memoryInput.value = "";
      renderMemory();
      notify("Memory ត្រូវបានរក្សាទុកក្នុង browser។");
    });
    panel.querySelector("[data-ai-memory-chat-save]").addEventListener("click", function () {
      var text = visibleChatText();
      if (!text) {
        notify("មិនមានសារដែលអាចរក្សាទុកទេ។", true);
        return;
      }
      api.memory.save(sessionId, text, "visible-chat");
      renderMemory();
      notify("សារដែលបង្ហាញក្នុង chat ត្រូវបានរក្សាទុក។");
    });
    panel.querySelector("[data-ai-memory-export]").addEventListener("click", function () {
      downloadJson("khoem-ai-memory.json", api.memory.export(sessionId));
      notify("Memory បាន export។");
    });
    memorySearch.addEventListener("input", renderMemory);

    window.KhoemAI.sessionId = sessionId;
    window.KhoemAI.memoryTools = {
      open: function () {
        launcher.click();
      },
      close: function () {
        panel.querySelector(".ai-memory-panel__close").click();
      },
      refreshHistory: function () {
        panel.querySelector("[data-ai-history-refresh]").click();
      },
    };
  }

  /*
   * Optional declarative bridge for new markup. Existing index.html has no
   * data-ai-action attributes, so this adds no listeners to the legacy UI.
   *
   * Example:
   * <button data-ai-action="chat" data-ai-session="..." data-ai-message="...">
   */
  api.bind = function (root) {
    var container = root || document;
    var elements = container.querySelectorAll("[data-ai-action]");
    Array.prototype.forEach.call(elements, function (element) {
      if (element.getAttribute("data-ai-bound") === "true") return;
      element.setAttribute("data-ai-bound", "true");
      element.addEventListener("click", function () {
        var action = element.getAttribute("data-ai-action");
        var sessionId = element.getAttribute("data-ai-session");
        var message = element.getAttribute("data-ai-message");
        var operation;

        if (action === "chat") {
          operation = api.chat(sessionId, message);
        } else if (action === "directions") {
          operation = api.directions(
            element.getAttribute("data-ai-origin"),
            element.getAttribute("data-ai-destination"),
            element.getAttribute("data-ai-mode")
          );
        } else {
          return;
        }

        operation.catch(function () {
          /* The global khoem-ai:error event remains available to the host UI. */
        });
      });
    });
    return api;
  };

  window.KhoemAI = api;
  document.addEventListener("DOMContentLoaded", function () {
    api.bind(document);
    window.setTimeout(createMemoryTools, 0);
  });
})(window, document);

