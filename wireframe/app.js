(() => {
  "use strict";

  const STORAGE_KEY = "flowline-demo-v1";
  const STAGES = ["R&D", "Planning", "Press", "Shipping", "Delivered"];
  const ROLE_PROFILES = {
    "CSR": {
      name: "Asha Menon",
      title: "Requestor / CSR",
      heading: "My order requests",
      description: "Create requests, respond to clarifications, and track every handoff.",
      primary: "Create new order"
    },
    "R&D": {
      name: "Dr. Ravi Shah",
      title: "R&D Expert",
      heading: "Technical review queue",
      description: "Assess feasibility, document constraints, and request clear corrections.",
      primary: "Review next order"
    },
    "Planning": {
      name: "Meera Iyer",
      title: "Planning",
      heading: "Material and capacity planning",
      description: "Confirm readiness, assign capacity, and release approved jobs.",
      primary: "Plan next order"
    },
    "Press": {
      name: "Joseph Paul",
      title: "Press",
      heading: "Production work queue",
      description: "Run scheduled jobs and record production progress and exceptions.",
      primary: "Open next job"
    },
    "Shipping": {
      name: "Noor Ali",
      title: "Shipping",
      heading: "Dispatch and delivery queue",
      description: "Verify readiness, dispatch finished goods, and confirm delivery.",
      primary: "Open next shipment"
    },
    "Manager": {
      name: "Leena Thomas",
      title: "Manager",
      heading: "Operations overview",
      description: "Monitor workload, aging, exceptions, and end-to-end performance.",
      primary: "Review exceptions"
    }
  };

  const ACTIONS = {
    submit: {
      title: "Submit for R&D review",
      description: "Confirm the request is complete before handing it to R&D.",
      confirm: "Submit order",
      fields: [{ name: "notes", label: "Submission note", type: "textarea", required: true }],
      transition: { status: "R&D Review", stage: "R&D", owner: "R&D", next: "Complete feasibility review" }
    },
    approve: {
      title: "Approve technical feasibility",
      description: "Record the recommendation and evidence supporting this decision.",
      confirm: "Approve feasibility",
      fields: [
        { name: "material", label: "Material recommendation", value: "PET / MET-PET / PE laminate", required: true },
        { name: "notes", label: "Technical comments", type: "textarea", required: true }
      ],
      transition: { status: "Planning Review", stage: "Planning", owner: "Planning", next: "Confirm materials and production capacity" }
    },
    schedule: {
      title: "Assign press and schedule",
      description: "Confirm material availability and reserve production capacity.",
      confirm: "Release to press",
      fields: [
        { name: "press", label: "Assigned press", value: "Press Line 03", required: true },
        { name: "date", label: "Production date", type: "date", value: "2026-10-21", required: true },
        { name: "notes", label: "Planning notes", type: "textarea", required: true }
      ],
      transition: { status: "Scheduled", stage: "Press", owner: "Press", next: "Accept and start the scheduled job" }
    },
    start: {
      title: "Start production",
      description: "Confirm the job setup is complete and record the production start.",
      confirm: "Start production",
      fields: [
        { name: "press", label: "Press line", value: "Press Line 03", required: true },
        { name: "notes", label: "Setup notes", type: "textarea", required: true }
      ],
      transition: { status: "In Production", stage: "Press", owner: "Press", next: "Record completed and waste quantities" }
    },
    complete: {
      title: "Complete production",
      description: "Record finished output before releasing the order to Shipping.",
      confirm: "Complete production",
      fields: [
        { name: "good", label: "Good quantity", type: "number", value: "50000", required: true },
        { name: "waste", label: "Waste quantity", type: "number", value: "820", required: true },
        { name: "notes", label: "Completion notes", type: "textarea", required: true }
      ],
      transition: { status: "Ready to Ship", stage: "Shipping", owner: "Shipping", next: "Confirm dispatch readiness" }
    },
    dispatch: {
      title: "Dispatch order",
      description: "Capture shipment details and release the finished goods.",
      confirm: "Confirm dispatch",
      fields: [
        { name: "carrier", label: "Carrier", value: "SouthLine Logistics", required: true },
        { name: "tracking", label: "Tracking number", value: "SL-584293", required: true },
        { name: "expected", label: "Expected delivery", type: "date", value: "2026-10-23", required: true }
      ],
      transition: { status: "Dispatched", stage: "Shipping", owner: "Shipping", next: "Confirm customer delivery" }
    },
    deliver: {
      title: "Confirm delivery",
      description: "Close the order lifecycle with delivery evidence.",
      confirm: "Confirm delivery",
      fields: [
        { name: "receivedBy", label: "Received by", required: true },
        { name: "notes", label: "Delivery evidence note", type: "textarea", required: true }
      ],
      transition: { status: "Delivered", stage: "Delivered", owner: "Complete", next: "No action required" }
    },
    hold: {
      title: "Place order on hold",
      description: "Identify the exception owner and corrective action.",
      confirm: "Place on hold",
      danger: true,
      fields: [
        { name: "category", label: "Hold category", type: "select", options: ["Material shortage", "Technical clarification", "Production issue", "Delivery issue"], required: true },
        { name: "owner", label: "Resolution owner", type: "select", options: ["CSR", "R&D", "Planning", "Press", "Shipping"], value: "Planning", required: true },
        { name: "target", label: "Target resolution date", type: "date", value: "2026-10-20", required: true },
        { name: "notes", label: "Required corrective action", type: "textarea", required: true }
      ]
    },
    rework: {
      title: "Send for rework",
      description: "Return the order for correction while preserving its audit trail.",
      confirm: "Send for rework",
      danger: true,
      fields: [
        { name: "owner", label: "Responsible team", type: "select", options: ["CSR", "R&D", "Planning", "Press"], required: true },
        { name: "notes", label: "Correction required", type: "textarea", required: true }
      ]
    },
    resolve: {
      title: "Resolve exception",
      description: "Record the resolution and return the order to its previous workflow stage.",
      confirm: "Resolve and resume",
      fields: [
        { name: "evidence", label: "Resolution evidence", type: "textarea", required: true }
      ]
    }
  };

  const SAMPLE_ORDERS = [
    {
      id: "FO-2026-1048",
      customer: "GreenBite Foods",
      product: "Sea Salt Crunch 120 g pouch",
      description: "High-barrier printed stand-up pouch for snack product.",
      status: "R&D Review",
      stage: "R&D",
      owner: "R&D",
      next: "Complete feasibility review",
      priority: "High",
      age: 2,
      requestedDate: "2026-10-28",
      quantity: 50000,
      packaging: "Stand-up pouch",
      dimensions: "180 × 260 mm",
      material: "PET / MET-PET / PE",
      colors: "8 colors",
      createdBy: "Asha Menon",
      timeline: [
        { at: "17 Oct 2026, 10:42", actor: "Asha Menon · CSR", title: "Submitted for technical review", note: "Artwork revision B and barrier requirement included." },
        { at: "17 Oct 2026, 09:16", actor: "Asha Menon · CSR", title: "Order created", note: "Customer target delivery confirmed for 28 October." }
      ]
    },
    {
      id: "FO-2026-1042",
      customer: "Harvest Kitchen",
      product: "Millet Mix 500 g laminate",
      description: "Printed rollstock for automated form-fill-seal packing.",
      status: "Planning Review",
      stage: "Planning",
      owner: "Planning",
      next: "Confirm materials and production capacity",
      priority: "Normal",
      age: 4,
      requestedDate: "2026-10-25",
      quantity: 80000,
      packaging: "Rollstock",
      dimensions: "420 mm web",
      material: "BOPP / CPP",
      colors: "6 colors",
      createdBy: "Devika Rao",
      timeline: [
        { at: "16 Oct 2026, 16:25", actor: "Dr. Ravi Shah · R&D", title: "Technical feasibility approved", note: "Existing cylinder set can be reused. Seal trials passed." },
        { at: "14 Oct 2026, 11:10", actor: "Devika Rao · CSR", title: "Order submitted", note: "Specification and approved artwork attached." }
      ]
    },
    {
      id: "FO-2026-1037",
      customer: "Natura Organics",
      product: "Granola 250 g recyclable pouch",
      description: "Mono-material recyclable pouch with matte finish.",
      status: "On Hold",
      previousStatus: "Planning Review",
      stage: "Planning",
      owner: "Planning",
      next: "Resolve material shortage",
      priority: "High",
      age: 7,
      requestedDate: "2026-10-24",
      quantity: 35000,
      packaging: "Flat-bottom pouch",
      dimensions: "160 × 230 mm",
      material: "PE mono-material",
      colors: "7 colors",
      createdBy: "Asha Menon",
      exception: {
        category: "Material shortage",
        owner: "Planning",
        target: "2026-10-20",
        note: "Awaiting 80-micron barrier-grade PE from approved supplier."
      },
      timeline: [
        { at: "16 Oct 2026, 14:05", actor: "Meera Iyer · Planning", title: "Order placed on hold", note: "Barrier-grade PE stock is short by 420 kg." },
        { at: "13 Oct 2026, 12:40", actor: "R&D Team", title: "Technical feasibility approved", note: "Material structure approved after migration review." }
      ]
    },
    {
      id: "FO-2026-1029",
      customer: "Sunrise Spices",
      product: "Turmeric 100 g sachet",
      description: "High-opacity printed sachet with aroma barrier.",
      status: "In Production",
      stage: "Press",
      owner: "Press",
      next: "Record completed and waste quantities",
      priority: "Normal",
      age: 5,
      requestedDate: "2026-10-22",
      quantity: 120000,
      packaging: "Three-side seal sachet",
      dimensions: "110 × 160 mm",
      material: "PET / PE",
      colors: "5 colors",
      createdBy: "Devika Rao",
      timeline: [
        { at: "17 Oct 2026, 08:20", actor: "Joseph Paul · Press", title: "Production started", note: "Press Line 02 running at approved color standard." },
        { at: "15 Oct 2026, 17:15", actor: "Meera Iyer · Planning", title: "Released to Press", note: "Materials issued and capacity reserved." }
      ]
    },
    {
      id: "FO-2026-1018",
      customer: "Coastal Coffee Co.",
      product: "Premium roast 1 kg bag",
      description: "Quad-seal coffee bag with degassing valve.",
      status: "Ready to Ship",
      stage: "Shipping",
      owner: "Shipping",
      next: "Confirm dispatch readiness",
      priority: "High",
      age: 8,
      requestedDate: "2026-10-19",
      quantity: 18000,
      packaging: "Quad-seal bag",
      dimensions: "200 × 340 mm",
      material: "PET / AL / PE",
      colors: "4 colors",
      createdBy: "Asha Menon",
      timeline: [
        { at: "17 Oct 2026, 12:35", actor: "Joseph Paul · Press", title: "Production completed", note: "18,120 good units; 290 units waste. Released to Shipping." },
        { at: "16 Oct 2026, 07:50", actor: "Joseph Paul · Press", title: "Production started", note: "Valve placement sample approved." }
      ]
    },
    {
      id: "FO-2026-1006",
      customer: "PureSip Beverages",
      product: "Hydration powder 20 g sachet",
      description: "Single-serve moisture-barrier sachet.",
      status: "Delivered",
      stage: "Delivered",
      owner: "Complete",
      next: "No action required",
      priority: "Normal",
      age: 12,
      requestedDate: "2026-10-16",
      quantity: 200000,
      packaging: "Four-side seal sachet",
      dimensions: "75 × 110 mm",
      material: "PET / AL / PE",
      colors: "6 colors",
      createdBy: "Devika Rao",
      timeline: [
        { at: "16 Oct 2026, 15:10", actor: "Noor Ali · Shipping", title: "Delivery confirmed", note: "Received by K. Sharma. Proof of delivery recorded." },
        { at: "15 Oct 2026, 06:45", actor: "Noor Ali · Shipping", title: "Order dispatched", note: "SouthLine Logistics, tracking SL-579188." }
      ]
    }
  ];

  const SAMPLE_NOTIFICATIONS = [
    {
      id: "NTF-2026-1037-HOLD",
      orderId: "FO-2026-1037",
      recipients: ["Planning", "Manager"],
      title: "Order placed on hold",
      category: "Material shortage",
      message: "Awaiting 80-micron barrier-grade PE from the approved supplier.",
      owner: "Planning",
      raisedBy: "Planning",
      target: "2026-10-20",
      createdAt: "16 Oct 2026, 14:05",
      readBy: [],
      active: true
    }
  ];

  const elements = {
    role: document.querySelector("#role-select"),
    notificationShell: document.querySelector(".notification-shell"),
    notificationToggle: document.querySelector("#notification-toggle"),
    notificationCount: document.querySelector("#notification-count"),
    notificationPanel: document.querySelector("#notification-panel"),
    notificationList: document.querySelector("#notification-list"),
    markAllRead: document.querySelector("#mark-all-read"),
    holdAlert: document.querySelector("#hold-alert"),
    holdAlertMessage: document.querySelector("#hold-alert-message"),
    holdAlertMeta: document.querySelector("#hold-alert-meta"),
    viewAlertOrder: document.querySelector("#view-alert-order"),
    readAlert: document.querySelector("#read-alert"),
    userName: document.querySelector("#user-name"),
    userRole: document.querySelector("#user-role"),
    eyebrow: document.querySelector("#page-eyebrow"),
    title: document.querySelector("#page-title"),
    description: document.querySelector("#page-description"),
    primary: document.querySelector("#primary-action"),
    metrics: document.querySelector("#metrics"),
    manager: document.querySelector("#manager-panel"),
    managerFilter: document.querySelector("#manager-filter"),
    stageChart: document.querySelector("#stage-chart"),
    riskList: document.querySelector("#risk-list"),
    queueLabel: document.querySelector("#queue-label"),
    count: document.querySelector("#order-count"),
    search: document.querySelector("#order-search"),
    status: document.querySelector("#status-filter"),
    list: document.querySelector("#order-list"),
    detail: document.querySelector("#order-detail"),
    reset: document.querySelector("#reset-demo"),
    dialog: document.querySelector("#action-dialog"),
    form: document.querySelector("#action-form"),
    dialogTitle: document.querySelector("#dialog-title"),
    dialogDescription: document.querySelector("#dialog-description"),
    fields: document.querySelector("#dialog-fields"),
    confirm: document.querySelector("#confirm-action"),
    error: document.querySelector("#form-error"),
    overviewTab: document.querySelector("#overview-tab"),
    activityTab: document.querySelector("#activity-tab"),
    history: document.querySelector("#activity-panel"),
    historyDescription: document.querySelector("#history-description"),
    historyList: document.querySelector("#history-list"),
    historyLatest: document.querySelector("#history-latest"),
    toast: document.querySelector("#toast")
  };

  let state = loadState();
  let activeAction = null;
  let activeBannerId = null;
  let toastTimer;

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved?.orders?.length) {
        return {
          ...saved,
          notifications: saved.notifications ?? structuredClone(SAMPLE_NOTIFICATIONS)
        };
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    return {
      role: "CSR",
      selectedId: SAMPLE_ORDERS[0].id,
      notifications: structuredClone(SAMPLE_NOTIFICATIONS),
      orders: structuredClone(SAMPLE_ORDERS)
    };
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function createElement(tag, options = {}, children = []) {
    const element = document.createElement(tag);
    Object.entries(options).forEach(([key, value]) => {
      if (key === "className") element.className = value;
      else if (key === "text") element.textContent = value;
      else if (key === "dataset") Object.assign(element.dataset, value);
      else if (key in element) element[key] = value;
      else element.setAttribute(key, value);
    });
    children.filter(Boolean).forEach((child) => element.append(child));
    return element;
  }

  function getVisibleOrders() {
    const search = elements.search.value.trim().toLowerCase();
    const status = elements.status.value;
    return state.orders.filter((order) => {
      const roleMatch = state.role === "Manager" || state.role === "CSR" ||
        order.owner === state.role || order.stage === state.role;
      const statusMatch = status === "All" || order.status === status;
      const textMatch = !search ||
        `${order.id} ${order.customer} ${order.product}`.toLowerCase().includes(search);
      return roleMatch && statusMatch && textMatch;
    });
  }

  function statusClass(status) {
    if (status === "Delivered") return "status status-success";
    if (status === "On Hold" || status === "Rework Required") return "status status-danger";
    if (status === "Scheduled" || status === "In Production") return "status status-warning";
    return "status";
  }

  function render() {
    renderHeader();
    renderNotifications();
    renderMetrics();
    renderManager();
    renderFilters();
    renderOrders();
    renderDetail();
  }

  function renderHeader() {
    const profile = ROLE_PROFILES[state.role];
    elements.role.value = state.role;
    elements.userName.textContent = profile.name;
    elements.userRole.textContent = profile.title;
    elements.eyebrow.textContent = `${profile.title} workspace`;
    elements.title.textContent = profile.heading;
    elements.description.textContent = profile.description;
    elements.primary.textContent = profile.primary;
    elements.queueLabel.textContent = state.role === "CSR" ? "My requests" : `${profile.title} queue`;
  }

  function getRoleNotifications() {
    return state.notifications
      .filter((notification) => notification.recipients.includes(state.role));
  }

  function isUnread(notification) {
    return !notification.readBy.includes(state.role);
  }

  function renderNotifications() {
    const notifications = getRoleNotifications();
    const unread = notifications.filter(isUnread);
    elements.notificationCount.textContent = String(unread.length);
    elements.notificationCount.hidden = unread.length === 0;
    elements.notificationToggle.setAttribute(
      "aria-label",
      unread.length ? `Open notifications, ${unread.length} unread` : "Open notifications"
    );
    elements.markAllRead.disabled = unread.length === 0;
    elements.notificationList.replaceChildren(
      ...(notifications.length
        ? notifications.map(renderNotificationItem)
        : [createElement("div", { className: "notification-empty" }, [
            createElement("strong", { text: "No notifications" }),
            createElement("p", { text: "Role alerts will appear here." })
          ])])
    );

    const banner = unread.find((notification) => notification.active);
    activeBannerId = banner?.id ?? null;
    elements.holdAlert.hidden = !banner;
    if (!banner) return;
    elements.holdAlertMessage.textContent = `${banner.orderId} · ${banner.category}: ${banner.message}`;
    elements.holdAlertMeta.textContent =
      `Assigned to ${banner.owner} · Target ${formatDate(banner.target)} · Raised by ${banner.raisedBy}`;
  }

  function renderNotificationItem(notification) {
    const button = createElement("button", {
      type: "button",
      className: `notification-item ${isUnread(notification) ? "unread" : ""}`,
      "aria-label": `${notification.title} for ${notification.orderId}`
    }, [
      createElement("div", { className: "notification-item-heading" }, [
        createElement("strong", { text: notification.title }),
        createElement("time", { text: notification.createdAt })
      ]),
      createElement("p", { text: `${notification.orderId} · ${notification.category}` }),
      createElement("small", {
        text: `${notification.owner} owner · Target ${formatDate(notification.target)}`
      })
    ]);
    button.addEventListener("click", () => openNotification(notification.id));
    return button;
  }

  function markNotificationRead(notification) {
    if (!notification.readBy.includes(state.role)) notification.readBy.push(state.role);
  }

  function openNotification(notificationId) {
    const notification = state.notifications.find((item) => item.id === notificationId);
    const order = state.orders.find((item) => item.id === notification?.orderId);
    if (!notification || !order) return;
    markNotificationRead(notification);
    state.selectedId = order.id;
    elements.search.value = "";
    elements.status.value = "All";
    closeNotificationPanel();
    saveState();
    render();
    setDetailTab("overview");
    document.querySelector(".workbench").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeNotificationPanel() {
    elements.notificationPanel.hidden = true;
    elements.notificationToggle.setAttribute("aria-expanded", "false");
  }

  function createHoldNotification(order, values) {
    const recipients = [...new Set([values.owner, "Manager"])];
    state.notifications.unshift({
      id: `NTF-${Date.now()}`,
      orderId: order.id,
      recipients,
      title: "Order placed on hold",
      category: values.category,
      message: values.notes,
      owner: values.owner,
      raisedBy: ROLE_PROFILES[state.role].title,
      target: values.target,
      createdAt: new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date()),
      readBy: [],
      active: true
    });
  }

  function renderMetrics() {
    const roleOrders = getRoleOrders();
    const overdue = roleOrders.filter((order) => order.age >= 7 && order.status !== "Delivered").length;
    const exceptions = roleOrders.filter((order) => order.exception).length;
    const complete = roleOrders.filter((order) => order.status === "Delivered").length;
    const metrics = [
      ["Active orders", roleOrders.filter((order) => order.status !== "Delivered").length],
      ["Attention required", exceptions],
      ["Aging 7+ days", overdue],
      [state.role === "Manager" ? "Delivered" : "Completed", complete]
    ];
    elements.metrics.replaceChildren(...metrics.map(([label, value]) =>
      createElement("div", { className: "metric-card" }, [
        createElement("small", { text: label }),
        createElement("strong", { text: String(value) })
      ])
    ));
  }

  function getRoleOrders() {
    if (state.role === "CSR" || state.role === "Manager") return state.orders;
    return state.orders.filter((order) => order.owner === state.role || order.stage === state.role);
  }

  function renderManager() {
    const isManager = state.role === "Manager";
    elements.manager.hidden = !isManager;
    if (!isManager) return;

    const team = elements.managerFilter.value;
    const orders = team === "All"
      ? state.orders
      : state.orders.filter((order) => order.owner === team || order.stage === team);
    const stageCounts = STAGES.map((stage) => [
      stage,
      orders.filter((order) => order.stage === stage).length
    ]);
    const max = Math.max(1, ...stageCounts.map(([, count]) => count));
    elements.stageChart.replaceChildren(...stageCounts.map(([stage, count]) =>
      createElement("div", { className: "bar-row" }, [
        createElement("span", { text: stage }),
        createElement("div", { className: "bar-track" }, [
          createElement("div", {
            className: "bar-value",
            title: `${count} orders`,
            style: `width: ${(count / max) * 100}%`
          })
        ]),
        createElement("strong", { text: String(count) })
      ])
    ));

    const risks = orders.filter((order) => order.exception || order.age >= 7).slice(0, 4);
    elements.riskList.replaceChildren(...(risks.length ? risks.map((order) =>
      createElement("div", { className: "risk-item" }, [
        createElement("span", {}, [
          createElement("strong", { text: order.id }),
          createElement("small", { text: ` · ${order.customer}` })
        ]),
        createElement("span", {
          className: order.exception ? "status status-danger" : "status status-warning",
          text: order.exception ? order.exception.category : `${order.age} days`
        })
      ])
    ) : [createElement("p", { text: "No orders currently need attention." })]));
  }

  function renderFilters() {
    const current = elements.status.value;
    const statuses = ["All", ...new Set(getRoleOrders().map((order) => order.status))];
    elements.status.replaceChildren(...statuses.map((status) =>
      createElement("option", { value: status, text: status })
    ));
    elements.status.value = statuses.includes(current) ? current : "All";
  }

  function renderOrders() {
    const orders = getVisibleOrders();
    elements.count.textContent = String(orders.length);
    elements.list.replaceChildren(...(orders.length ? orders.map((order) => {
      const button = createElement("button", {
        type: "button",
        className: "order-card",
        "aria-current": String(order.id === state.selectedId),
        "aria-label": `${order.id}, ${order.customer}, ${order.status}`
      }, [
        createElement("div", { className: "order-card-header" }, [
          createElement("span", { className: statusClass(order.status), text: order.status }),
          createElement("span", { className: "priority", text: `${order.priority} priority` })
        ]),
        createElement("span", { className: "order-card-title", text: order.product }),
        createElement("p", { text: `${order.id} · ${order.customer}` }),
        createElement("div", { className: "order-card-meta" }, [
          createElement("span", { text: `${order.owner} owner` }),
          createElement("span", { text: `${order.age} days` })
        ])
      ]);
      button.addEventListener("click", () => {
        state.selectedId = order.id;
        saveState();
        renderOrders();
        renderDetail();
      });
      return button;
    }) : [createElement("div", { className: "empty-state" }, [
      createElement("strong", { text: "No matching orders" }),
      createElement("p", { text: "Adjust the search or status filter." })
    ])]));
  }

  function renderDetail() {
    const order = state.orders.find((item) => item.id === state.selectedId);
    if (!order) return;
    syncHistoryPanel(order);

    const header = createElement("div", { className: "detail-header" }, [
      createElement("div", {}, [
        createElement("span", { className: statusClass(order.status), text: order.status }),
        createElement("h2", { text: order.product }),
        createElement("p", { text: `${order.id} · ${order.customer}` })
      ]),
      createElement("div", { className: "owner-block" }, [
        createElement("small", { text: "Current owner" }),
        createElement("strong", { text: order.owner })
      ])
    ]);
    elements.detail.replaceChildren(
      header,
      renderStageTrack(order),
      renderNextAction(order),
      renderSummary(order),
      renderDetailColumns(order)
    );
  }

  function renderStageTrack(order) {
    const activeIndex = Math.max(0, STAGES.indexOf(order.stage));
    return createElement("div", { className: "stage-track", "aria-label": "Order progress" },
      STAGES.map((stage, index) => createElement("div", {
        className: `stage-step ${index < activeIndex ? "complete" : index === activeIndex ? "current" : ""}`,
        text: stage,
        "aria-current": index === activeIndex ? "step" : "false"
      }))
    );
  }

  function renderNextAction(order) {
    return createElement("div", { className: "next-action" }, [
      createElement("div", {}, [
        createElement("strong", { text: order.exception ? "Exception requires resolution" : "Next required action" }),
        createElement("p", { text: order.next })
      ]),
      createElement("div", { className: "action-group" },
        getActions(order).map(({ id, label, danger }) => {
          const button = createElement("button", {
            type: "button",
            className: `button ${danger ? "button-danger" : id === "hold" || id === "rework" ? "button-secondary" : "button-primary"}`,
            text: label
          });
          button.addEventListener("click", () => openAction(id, order));
          return button;
        })
      )
    ]);
  }

  function getActions(order) {
    if (order.exception) {
      const canResolve = state.role === "Manager" || state.role === order.owner;
      return canResolve ? [{ id: "resolve", label: "Resolve exception" }] : [];
    }
    if (order.status === "Delivered") return [];
    const primaryByState = {
      "Draft": ["submit", "Submit for review"],
      "R&D Review": ["approve", "Approve feasibility"],
      "Planning Review": ["schedule", "Assign and release"],
      "Scheduled": ["start", "Start production"],
      "In Production": ["complete", "Complete production"],
      "Ready to Ship": ["dispatch", "Dispatch order"],
      "Dispatched": ["deliver", "Confirm delivery"],
      "Rework Required": ["resolve", "Resolve rework"]
    };
    const actions = [];
    const primary = primaryByState[order.status];
    const canAct = state.role === order.owner ||
      (state.role === "CSR" && order.status === "Draft");
    if (primary && canAct) actions.push({ id: primary[0], label: primary[1] });
    if (canAct) {
      actions.push({ id: "hold", label: "Place on hold" });
      actions.push({ id: "rework", label: "Send for rework" });
    }
    return actions;
  }

  function renderSummary(order) {
    const items = [
      ["Requested delivery", formatDate(order.requestedDate)],
      ["Quantity", order.quantity.toLocaleString("en-IN")],
      ["Priority", order.priority],
      ["Created by", order.createdBy],
      ["Order age", `${order.age} days`],
      ["Next owner", order.owner]
    ];
    return createElement("div", { className: "summary-grid" },
      items.map(([label, value]) => createElement("div", { className: "summary-item" }, [
        createElement("small", { text: label }),
        createElement("strong", { text: value })
      ]))
    );
  }

  function renderDetailColumns(order) {
    const details = [
      ["Packaging", order.packaging],
      ["Dimensions", order.dimensions],
      ["Material", order.material],
      ["Print specification", order.colors]
    ];
    if (order.exception) {
      details.push(["Hold category", order.exception.category]);
      details.push(["Resolution target", formatDate(order.exception.target)]);
    }
    return createElement("div", { className: "detail-columns" }, [
      createElement("section", { "aria-labelledby": "spec-heading" }, [
        createElement("h3", { id: "spec-heading", text: "Order specification" }),
        createElement("p", { text: order.description }),
        createElement("dl", { className: "spec-list" },
          details.map(([label, value]) => createElement("div", {}, [
            createElement("dt", { text: label }),
            createElement("dd", { text: value })
          ]))
        )
      ])
    ]);
  }

  function renderTimelineEvent(event) {
    const [date, time = ""] = event.at.split(", ");
    const [actor, role = "Team member"] = event.actor.split(" · ");
    return createElement("li", {}, [
      createElement("time", { className: "timeline-when" }, [
        createElement("strong", { text: date }),
        createElement("span", { text: time })
      ]),
      createElement("div", { className: "event-node", "aria-hidden": "true" }, [
        createElement("span", {
          className: "event-avatar",
          text: actor.trim().charAt(0).toUpperCase()
        })
      ]),
      createElement("article", { className: "event-card" }, [
        createElement("div", { className: "event-heading" }, [
          createElement("strong", { text: event.title })
        ]),
        createElement("div", { className: "event-actor" }, [
          createElement("span", { text: actor }),
          createElement("small", { text: role })
        ]),
        createElement("p", { text: event.note })
      ])
    ]);
  }

  function syncHistoryPanel(order) {
    elements.historyDescription.textContent = `${order.id} · ${order.customer} · ${order.timeline.length} records`;
    elements.historyLatest.textContent = order.timeline[0]?.title ?? "No activity recorded";
    elements.historyList.replaceChildren(...order.timeline.map(renderTimelineEvent));
  }

  function setDetailTab(tabName, focus = false) {
    const activitySelected = tabName === "activity";
    elements.overviewTab.classList.toggle("active", !activitySelected);
    elements.activityTab.classList.toggle("active", activitySelected);
    elements.overviewTab.setAttribute("aria-selected", String(!activitySelected));
    elements.activityTab.setAttribute("aria-selected", String(activitySelected));
    elements.overviewTab.tabIndex = activitySelected ? -1 : 0;
    elements.activityTab.tabIndex = activitySelected ? 0 : -1;
    elements.detail.hidden = activitySelected;
    elements.history.hidden = !activitySelected;
    if (focus) (activitySelected ? elements.activityTab : elements.overviewTab).focus();
  }

  function openAction(actionId, order) {
    activeAction = { id: actionId, orderId: order.id };
    const action = ACTIONS[actionId];
    elements.dialogTitle.textContent = action.title;
    elements.dialogDescription.textContent = action.description;
    elements.confirm.textContent = action.confirm;
    elements.confirm.className = `button ${action.danger ? "button-danger" : "button-primary"}`;
    elements.error.hidden = true;
    elements.fields.replaceChildren(...action.fields.map(createField));
    elements.dialog.showModal();
  }

  function createField(field) {
    const id = `field-${field.name}`;
    let input;
    if (field.type === "textarea") {
      input = createElement("textarea", { id, name: field.name, required: field.required });
    } else if (field.type === "select") {
      input = createElement("select", { id, name: field.name, required: field.required },
        field.options.map((option) => createElement("option", { value: option, text: option }))
      );
      if (field.value) input.value = field.value;
    } else {
      input = createElement("input", {
        id,
        name: field.name,
        type: field.type || "text",
        value: field.value || "",
        required: field.required,
        min: field.type === "number" ? "0" : undefined
      });
    }
    const label = createElement("label", {
      className: `field ${field.type === "textarea" ? "field-wide" : ""}`,
      htmlFor: id
    }, [
      createElement("span", { text: `${field.label}${field.required ? " *" : ""}` }),
      input
    ]);
    return label;
  }

  function submitAction(event) {
    event.preventDefault();
    if (!elements.form.checkValidity()) {
      elements.error.textContent = "Complete all required fields before continuing.";
      elements.error.hidden = false;
      elements.form.reportValidity();
      return;
    }
    const order = state.orders.find((item) => item.id === activeAction.orderId);
    const action = ACTIONS[activeAction.id];
    const values = Object.fromEntries(new FormData(elements.form));
    applyAction(order, activeAction.id, action, values);
    saveState();
    elements.dialog.close();
    render();
    showToast(`${action.title} recorded for ${order.id}.`);
  }

  function applyAction(order, actionId, action, values) {
    if (actionId === "hold") {
      order.previousStatus = order.status;
      order.status = "On Hold";
      order.next = `Resolve ${values.category.toLowerCase()}`;
      order.owner = values.owner;
      order.exception = {
        category: values.category,
        owner: values.owner,
        target: values.target,
        note: values.notes
      };
      createHoldNotification(order, values);
    } else if (actionId === "rework") {
      order.previousStatus = order.status;
      order.status = "Rework Required";
      order.owner = values.owner;
      order.stage = values.owner === "CSR" ? "R&D" : values.owner;
      order.next = "Complete required correction and submit for re-review";
      order.exception = {
        category: "Rework required",
        owner: values.owner,
        target: "2026-10-21",
        note: values.notes
      };
    } else if (actionId === "resolve") {
      order.status = order.previousStatus || "Planning Review";
      order.owner = order.stage;
      order.next = nextActionForStatus(order.status);
      state.notifications
        .filter((notification) => notification.orderId === order.id)
        .forEach((notification) => {
          notification.active = false;
        });
      delete order.exception;
      delete order.previousStatus;
    } else {
      Object.assign(order, action.transition);
    }

    order.timeline.unshift({
      at: new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date()),
      actor: `${ROLE_PROFILES[state.role].name} · ${ROLE_PROFILES[state.role].title}`,
      title: action.title,
      note: Object.values(values).filter(Boolean).join(" · ")
    });
  }

  function nextActionForStatus(status) {
    return {
      "R&D Review": "Complete feasibility review",
      "Planning Review": "Confirm materials and production capacity",
      "Scheduled": "Accept and start the scheduled job",
      "In Production": "Record completed and waste quantities",
      "Ready to Ship": "Confirm dispatch readiness",
      "Dispatched": "Confirm customer delivery"
    }[status] || "Review order";
  }

  function openCreateOrder() {
    activeAction = { id: "create" };
    elements.dialogTitle.textContent = "Create new order";
    elements.dialogDescription.textContent = "Capture a complete request. Save it as a draft before R&D submission.";
    elements.confirm.textContent = "Save draft";
    elements.confirm.className = "button button-primary";
    elements.error.hidden = true;
    const fields = [
      { name: "customer", label: "Customer name", required: true },
      { name: "product", label: "Product name", required: true },
      { name: "packaging", label: "Packaging type", required: true },
      { name: "quantity", label: "Requested quantity", type: "number", required: true },
      { name: "requestedDate", label: "Requested delivery date", type: "date", required: true },
      { name: "material", label: "Material structure", required: true },
      { name: "description", label: "Technical notes", type: "textarea", required: true }
    ];
    elements.fields.replaceChildren(...fields.map(createField));
    elements.dialog.showModal();
  }

  function submitCreateOrder(event) {
    event.preventDefault();
    if (!elements.form.checkValidity()) {
      elements.error.textContent = "Complete all required fields before saving the draft.";
      elements.error.hidden = false;
      elements.form.reportValidity();
      return;
    }
    const values = Object.fromEntries(new FormData(elements.form));
    const number = Math.max(...state.orders.map((order) => Number(order.id.split("-").pop()))) + 1;
    const id = `FO-2026-${number}`;
    state.orders.unshift({
      id,
      customer: values.customer,
      product: values.product,
      description: values.description,
      status: "Draft",
      stage: "R&D",
      owner: "CSR",
      next: "Complete required information and submit for review",
      priority: "Normal",
      age: 0,
      requestedDate: values.requestedDate,
      quantity: Number(values.quantity),
      packaging: values.packaging,
      dimensions: "To be confirmed",
      material: values.material,
      colors: "To be confirmed",
      createdBy: ROLE_PROFILES[state.role].name,
      timeline: [{
        at: "17 Oct 2026, 18:26",
        actor: `${ROLE_PROFILES[state.role].name} · CSR`,
        title: "Order draft created",
        note: "Initial customer and product requirements recorded."
      }]
    });
    state.selectedId = id;
    saveState();
    elements.dialog.close();
    render();
    showToast(`${id} saved as a draft.`);
  }

  function selectNextOrder() {
    const order = getVisibleOrders().find((item) => item.status !== "Delivered");
    if (!order) {
      showToast("There are no active orders in this queue.");
      return;
    }
    state.selectedId = order.id;
    saveState();
    renderOrders();
    renderDetail();
    elements.detail.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function formatDate(value) {
    if (!value) return "Not set";
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(new Date(`${value}T12:00:00`));
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    toastTimer = setTimeout(() => {
      elements.toast.hidden = true;
    }, 3200);
  }

  elements.role.addEventListener("change", (event) => {
    state.role = event.target.value;
    elements.search.value = "";
    elements.status.value = "All";
    closeNotificationPanel();
    const first = getRoleOrders()[0];
    if (first) state.selectedId = first.id;
    saveState();
    render();
  });
  elements.search.addEventListener("input", renderOrders);
  elements.status.addEventListener("change", renderOrders);
  elements.managerFilter.addEventListener("change", renderManager);
  elements.primary.addEventListener("click", () => {
    if (state.role === "CSR") openCreateOrder();
    else selectNextOrder();
  });
  elements.reset.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    state = {
      role: "CSR",
      selectedId: SAMPLE_ORDERS[0].id,
      notifications: structuredClone(SAMPLE_NOTIFICATIONS),
      orders: structuredClone(SAMPLE_ORDERS)
    };
    elements.search.value = "";
    elements.status.value = "All";
    saveState();
    render();
    showToast("Demo data has been reset.");
  });
  elements.form.addEventListener("submit", (event) => {
    if (activeAction?.id === "create") submitCreateOrder(event);
    else submitAction(event);
  });
  document.querySelector("#close-dialog").addEventListener("click", () => elements.dialog.close());
  document.querySelector("#cancel-dialog").addEventListener("click", () => elements.dialog.close());
  elements.overviewTab.addEventListener("click", () => setDetailTab("overview"));
  elements.activityTab.addEventListener("click", () => setDetailTab("activity"));
  elements.notificationToggle.addEventListener("click", () => {
    const willOpen = elements.notificationPanel.hidden;
    elements.notificationPanel.hidden = !willOpen;
    elements.notificationToggle.setAttribute("aria-expanded", String(willOpen));
  });
  elements.markAllRead.addEventListener("click", () => {
    getRoleNotifications().forEach(markNotificationRead);
    saveState();
    renderNotifications();
  });
  elements.viewAlertOrder.addEventListener("click", () => openNotification(activeBannerId));
  elements.readAlert.addEventListener("click", () => {
    const notification = state.notifications.find((item) => item.id === activeBannerId);
    if (!notification) return;
    markNotificationRead(notification);
    saveState();
    renderNotifications();
  });
  [elements.overviewTab, elements.activityTab].forEach((tab) => {
    tab.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      setDetailTab(tab === elements.overviewTab ? "activity" : "overview", true);
    });
  });
  elements.dialog.addEventListener("click", (event) => {
    if (event.target === elements.dialog) elements.dialog.close();
  });
  document.addEventListener("click", (event) => {
    if (!elements.notificationShell.contains(event.target)) closeNotificationPanel();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeNotificationPanel();
  });

  render();
})();
