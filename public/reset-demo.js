/* Remove the sample dashboard content: this site starts with the real server data only. */
(function resetSampleContent() {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  // A previous local prototype could have left an example poster in this browser.
  try { localStorage.removeItem('lifeSantosPublishedPlan'); } catch {}

  const statCards = $$('.stat-card');
  if (statCards[0]) statCards[0].querySelector('strong').textContent = '0';
  if (statCards[1]) statCards[1].querySelector('strong').textContent = '0';
  if (statCards[2]) statCards[2].querySelector('strong').textContent = '—';
  $$('.stat-caption em').forEach(el => el.remove());
  const weekList = $('.week-list');
  if (weekList) weekList.innerHTML = '<p class="subheading" style="padding:16px">Aucun événement publié pour le moment.</p>';
  $$('.suggestion-preview').forEach(el => el.remove());

  // Players only see a real poster once staff publish one.
  const dates = $('#publicPlanDates');
  if (dates) dates.textContent = 'Aucun planning publié';
  const published = $('#publicPlanPublished');
  if (published) published.textContent = 'Le prochain planning apparaîtra ici.';
  const publicEmpty = $('#publicPlanEmpty');
  if (publicEmpty) publicEmpty.innerHTML = '<div class="empty-planning"><b>Pas encore de planning</b><span>Le staff publiera ici la prochaine affiche de la semaine.</span></div>';
  const preview = $('#planImagePreview');
  if (preview) preview.innerHTML = '<div class="empty-planning"><b>Ton affiche apparaîtra ici</b><span>Importe une création du studio ou de Canva.</span></div>';
  const startInput = $('#planStart'), endInput = $('#planEnd');
  if (startInput && endInput) {
    const now = new Date(), monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    startInput.value = iso(monday); endInput.value = iso(sunday);
    const range = `${monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} — ${sunday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    const banner = $('.planning-banner b'), calTitle = $('.calendar-title b');
    if (banner) banner.textContent = `Planning de la semaine · ${range}`;
    if (calTitle) calTitle.textContent = range;
    const days = $$('.calendar-head > div:not(.time-col)');
    days.forEach((el, i) => { const day = new Date(monday); day.setDate(monday.getDate() + i); el.innerHTML = `${day.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '').toUpperCase()} <b>${day.getDate()}</b>`; });
    $$('.cal-day').forEach(el => { el.innerHTML = ''; });
    const count = $('.calendar-title span:last-child'); if (count) count.textContent = '0 événement';
  }

  // Suggestions and models start empty; the API bridge fills suggestions after login.
  const suggestionList = $('.suggestion-list');
  if (suggestionList) suggestionList.innerHTML = '<p class="subheading" style="padding:18px">Connecte-toi pour voir les suggestions.</p>';
  $$('.suggestion-filters .filter i').forEach(el => { el.textContent = '0'; });
  const messages = $('#chatMessages'); if (messages) messages.innerHTML = '<p class="subheading">Aucune conversation sélectionnée.</p>';
  const description = $('#ideaDescription'); if (description) description.textContent = 'Sélectionne une suggestion pour ouvrir la conversation.';
  const library = $('.library-grid');
  if (library) library.innerHTML = '<div class="empty-planning"><b>Aucun modèle enregistré</b><span>Crée une affiche dans le studio, puis enregistre-la ici.</span></div>';
  $$('.library-filters i').forEach(el => { el.textContent = '0'; });

  // Never show sample people or claim that Discord is connected before credentials exist.
  const staffRows = $$('.staff-row:not(.staff-head)'); staffRows.forEach(row => row.remove());
  $('#addStaff')?.remove();
  const connection = $('.connected-pill');
  if (connection) { connection.classList.remove('connected-pill'); connection.classList.add('status-pill', 'pending'); connection.innerHTML = 'À configurer dans Render'; }
  const channelSelect = $('.bot-settings select');
  if (channelSelect) channelSelect.innerHTML = '<option value="">Détecte les salons Discord</option>';
  const roleSelect = $('.role-select'); if (roleSelect) roleSelect.textContent = 'Détecte les rôles Discord';
  const botPanel = $('.bot-settings');
  if (botPanel) {
    $$('.setting-row button.toggle', botPanel).forEach(button => button.remove());
    $$('.setting-row', botPanel)[0]?.remove();
    $('.prototype-note', botPanel)?.remove();
  }
  if (botPanel && !$('#detectDiscordResources')) {
    const button = document.createElement('button'); button.id = 'detectDiscordResources'; button.className = 'button secondary'; button.textContent = '↻ Détecter les salons et rôles';
    $('.panel-heading', botPanel)?.append(button);
  }
  const notice = $('.admin-notice');
  if (notice) notice.innerHTML = '<span>ⓘ</span> Aucun compte de démonstration n’est préenregistré. Ajoute les IDs des membres staff dans STAFF_USER_IDS ou utilise STAFF_ROLE_IDS dans Render.';
  const planningNotice = $('.planning-bottom > span');
  if (planningNotice) planningNotice.innerHTML = '<span class="online-dot"></span> À la publication, le site poste l’affiche dans le salon Discord choisi et peut mentionner le rôle des joueurs.';
  const badge = $('.nav-item[data-page="suggestions"] .badge'); if (badge) badge.remove();
  const botState = $('.bot-card small'); if (botState) botState.textContent = 'À configurer';
  const profile = $('.profile');
  if (profile) { $('b', profile).textContent = 'Connexion Discord'; $('small', profile).textContent = 'Connecte-toi pour continuer'; }

  // Start the studio with editable placeholders instead of a fictional event poster.
  $$('.template-card').forEach(card => card.remove());
  const panelHint = $('.tool-panel .panel-hint'); if (panelHint) panelHint.textContent = 'Canevas vierge · 1080 × 1350 px';
  const title = $('.poster-copy'); if (title) title.innerHTML = '<span>TON TITRE</span><b>ICI</b>';
  const subtitle = $('.poster-subtitle'); if (subtitle) subtitle.textContent = 'TON SOUS-TITRE';
  const meta = $$('.poster-meta span'); if (meta[0]) meta[0].textContent = 'DATE'; if (meta[1]) meta[1].textContent = 'HEURE';
  const place = $('.poster-place'); if (place) place.innerHTML = 'LIEU <span>·</span> DÉTAILS';
  const footer = $('.poster-bottom'); if (footer) footer.innerHTML = 'TON MESSAGE';
  const textValue = $('#textValue'); if (textValue) textValue.value = 'TON TITRE ICI';
})();
