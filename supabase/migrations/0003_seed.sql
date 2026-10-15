-- Marketing Design Hub — reference data (CLAUDE.md §4.3 and §6.2–6.11).
-- General Information questions (§6.1) are built into the form, not seeded here.
-- The Marketing roster (people and roles) is seeded separately: npm run seed:team.

insert into public.teams (name, is_marketing, sort_order) values
  ('AI/ML', false, 1),
  ('Cloud & Data', false, 2),
  ('QA', false, 3),
  ('Software Services', false, 4),
  ('Marketing', true, 5),
  ('Sales', false, 6),
  ('Human Resources', false, 7),
  ('Finance & Admin', false, 8),
  ('ITSM', false, 9),
  ('Product Strategy', false, 10);

insert into public.request_types (name, sort_order) values
  ('Presentation Deck', 1),
  ('Social Media Materials (static)', 2),
  ('Social Media Materials (dynamic)', 3),
  ('External Event Collaterals', 4),
  ('Stratpoint Website Assets / Development', 5),
  ('Newsletters / Emails', 6),
  ('Internal Company / Holiday Event Material', 7),
  ('Marketing Print and Digital Publications', 8),
  ('New Merchandise Design', 9),
  ('Others / Stratpoint Initiatives', 10);

-- Columns: request type, order, label, field type, options, allow "Other",
-- required, is "Output Needed" (★), help text.
insert into public.form_questions (
  request_type_id, sort_order, label, field_type, options, allow_other, required, is_output_needed, help_text
)
select t.id, q.sort_order, q.label, q.field_type::public.field_type, q.options::jsonb,
       q.allow_other, q.required, q.is_output_needed, q.help_text
from (values
  -- 6.2 Presentation Deck
  ('Presentation Deck', 1, 'Project Overview and Objective', 'long_text', '[]', false, true, false,
   'Please provide a brief background of the project, its purpose, and the objective you want to achieve. This will help the Designers better understand the context and direction of your request.'),
  ('Presentation Deck', 2, 'Output Needed', 'single_select',
   '["Deck Template - no content, design only", "Deck Enhancement - already has content, need help to enhance the look"]',
   false, true, true,
   'Deck designs adhere to Stratpoint brand guidelines; off-brand elements will be removed'),
  ('Presentation Deck', 3, 'Link to existing deck', 'short_text', '[]', false, false, false,
   'Content MUST be completed before sending. Otherwise, designers will only work on the currently existing slides.'),
  ('Presentation Deck', 4, 'Mandatory graphics', 'long_text', '[]', false, false, false,
   'Any element required in the template (e.g. logos). Please provide file links for any required logos or images. If irrelevant, put N/A.'),
  ('Presentation Deck', 5, 'Other important information', 'long_text', '[]', false, false, false,
   'If irrelevant, put N/A.'),

  -- 6.3 Social Media Materials (static)
  ('Social Media Materials (static)', 1, 'Target Audience', 'short_text', '[]', false, false, false, null),
  ('Social Media Materials (static)', 2, 'Platform/s', 'multi_select',
   '["Facebook", "LinkedIn", "Twitter/X", "Instagram", "TikTok", "YouTube"]', false, false, false, null),
  ('Social Media Materials (static)', 3, 'Type of social media material', 'single_select',
   '["Single artwork", "Rectangle artwork (e.g. text-heavy infographic)", "Multi-image tiles", "Story post"]',
   true, true, true, null),
  ('Social Media Materials (static)', 4, 'Copy', 'long_text', '[]', false, true, false,
   'Place detailed text content or link to the document/slides file.'),
  ('Social Media Materials (static)', 5, 'Mandatory graphics', 'long_text', '[]', false, false, false,
   'Any element required in the template (e.g. logos). Please provide file links for any required logos or images. If irrelevant, put N/A.'),
  ('Social Media Materials (static)', 6, 'Design pegs/graphics', 'long_text', '[]', false, false, false,
   'You may suggest a specific design or provide links to existing assets. If not applicable, put N/A.'),
  ('Social Media Materials (static)', 7, 'Other important information', 'long_text', '[]', false, false, false,
   'If irrelevant, put N/A.'),

  -- 6.4 Social Media Materials (dynamic)
  ('Social Media Materials (dynamic)', 1, 'Target Audience', 'short_text', '[]', false, false, false, null),
  ('Social Media Materials (dynamic)', 2, 'Platform/s', 'multi_select',
   '["Facebook", "LinkedIn", "Twitter/X", "Instagram", "TikTok", "YouTube"]', false, false, false, null),
  ('Social Media Materials (dynamic)', 3, 'Type of social media material', 'single_select',
   '["GIF artwork", "Video with static images", "Video with stock videos", "Full video production VI (for new video projects)", "First cut of full video production (for Design Team)", "Final cut of full video production", "Video assets/supers", "Reel/dynamic story", "Minor video update/cutting"]',
   true, true, true, null),
  ('Social Media Materials (dynamic)', 4, 'Copy', 'long_text', '[]', false, true, false,
   'Place detailed text content or link to the document/slides file.'),
  ('Social Media Materials (dynamic)', 5, 'Mandatory video requirements', 'long_text', '[]', false, false, false,
   'Any specifications required in the video (e.g. music, length of video, animations, video dimensions, etc.) Please provide file links for any required elements.'),
  ('Social Media Materials (dynamic)', 6, 'Design pegs/graphics', 'long_text', '[]', false, false, false,
   'You may suggest a specific design or provide links to existing assets. If irrelevant, put N/A.'),
  ('Social Media Materials (dynamic)', 7, 'Other important information', 'long_text', '[]', false, false, false,
   'If irrelevant, put N/A.'),

  -- 6.5 External Event Collaterals
  ('External Event Collaterals', 1, 'Target Audience', 'short_text', '[]', false, false, false, null),
  ('External Event Collaterals', 2, 'Event Type', 'single_select',
   '["Physical", "Virtual", "Hybrid"]', false, false, false, null),
  ('External Event Collaterals', 3, 'Specific event platform and/or location', 'short_text', '[]', false, false, false, null),
  ('External Event Collaterals', 4, 'Material needed', 'single_select',
   '["Event video", "Booth backdrop (physical)", "Pull-up banner (physical)", "Acrylic stand (physical)", "Google form header", "Virtual booth", "Social media post", "Presentation deck template"]',
   true, true, true,
   'For new merchandise requests, please fill out separate form/s with different Request Type.'),
  ('External Event Collaterals', 5, 'Detailed information about the materials', 'long_text', '[]', false, true, false,
   'Place information about the requested material/s (e.g. dimensions for the platform/s, design and print specifications, length of video, background music, etc.)'),
  ('External Event Collaterals', 6, 'Copy', 'long_text', '[]', false, true, false,
   'Place detailed text content or link to the document/slides file.'),
  ('External Event Collaterals', 7, 'Mandatory graphics', 'long_text', '[]', false, false, false,
   'Any element required in the template (e.g. logos). Please provide file links for any required elements. If irrelevant, put N/A.'),
  ('External Event Collaterals', 8, 'Design pegs/graphics', 'long_text', '[]', false, false, false,
   'You may suggest a specific design or provide links to existing assets. If irrelevant, put N/A.'),
  ('External Event Collaterals', 9, 'Other important information', 'long_text', '[]', false, false, false,
   'If irrelevant, put N/A.'),

  -- 6.6 Stratpoint Website Assets / Development
  ('Stratpoint Website Assets / Development', 1, 'Link to website content reference file', 'short_text', '[]', false, false, false, null),
  ('Stratpoint Website Assets / Development', 2, 'Link to wireframes', 'short_text', '[]', false, false, false, null),
  ('Stratpoint Website Assets / Development', 3, 'Material/s needed', 'single_select',
   '["Landing page header", "Icons", "Images", "Blog header", "Wireframe", "Wordpress blog page development", "Wordpress landing page development"]',
   true, true, true, null),
  ('Stratpoint Website Assets / Development', 4, 'Mandatory graphics', 'long_text', '[]', false, false, false,
   'Any element required in the page (e.g. logos, specific imagery). Please provide file links for any required elements. If irrelevant, put N/A.'),

  -- 6.7 Newsletters / Emails
  ('Newsletters / Emails', 1, 'Link to existing content reference file', 'short_text', '[]', false, false, false, null),
  ('Newsletters / Emails', 2, 'Material/s needed', 'single_select',
   '["Email layout", "Marketing Hub page", "LinkedIn newsletter article", "Timesheet pop-ups", "Wookie push notification", "Wookie in-app notification", "Email PDF", "Email Header"]',
   true, true, true, null),
  ('Newsletters / Emails', 3, 'Mandatory graphics', 'long_text', '[]', false, false, false,
   'Any element required in the template (e.g. logos). Please provide file links for any required elements. If irrelevant, put N/A.'),
  ('Newsletters / Emails', 4, 'Design pegs/graphics', 'long_text', '[]', false, false, false,
   'You may suggest a specific design or provide links to existing assets. If irrelevant, put N/A.'),
  ('Newsletters / Emails', 5, 'Other important information', 'long_text', '[]', false, false, false,
   'If irrelevant, put N/A.'),

  -- 6.8 Internal Company / Holiday Event Material
  ('Internal Company / Holiday Event Material', 1, 'Project Overview and Objective', 'long_text', '[]', false, true, false,
   'Please provide a brief background of the project, its purpose, and the objective you want to achieve. This will help the Designers better understand the context and direction of your request.'),
  ('Internal Company / Holiday Event Material', 2, 'Type of material', 'single_select',
   '["Full visual identity", "Event announcement card", "Event slides", "Event background"]',
   false, true, true, null),
  ('Internal Company / Holiday Event Material', 3, 'Theme', 'long_text', '[]', false, false, false,
   'You may also add a short description if relevant.'),
  ('Internal Company / Holiday Event Material', 4, 'Copy', 'long_text', '[]', false, true, false,
   'Place detailed text content or link to the document/slides file.'),
  ('Internal Company / Holiday Event Material', 5, 'Mandatory graphics', 'long_text', '[]', false, false, false,
   'Any element required in the template (e.g. logos). Please provide file links for any required elements. If irrelevant, put N/A.'),
  ('Internal Company / Holiday Event Material', 6, 'Design pegs/graphics', 'long_text', '[]', false, false, false,
   'You may suggest a specific design or provide links to existing assets. If irrelevant, put N/A.'),
  ('Internal Company / Holiday Event Material', 7, 'Other important information', 'long_text', '[]', false, false, false,
   'If irrelevant, put N/A.'),

  -- 6.9 Marketing Print and Digital Publications
  ('Marketing Print and Digital Publications', 1, 'Type of design material', 'single_select',
   '["HubSpot landing page", "One-pager (print/PDF)", "Brochures", "Case study PDF", "E-Book/White paper"]',
   true, true, true, null),
  ('Marketing Print and Digital Publications', 2, 'Copy/Content', 'long_text', '[]', false, true, false,
   'Place detailed text content or link to the document/slides file.'),
  ('Marketing Print and Digital Publications', 3, 'Mandatory graphics', 'long_text', '[]', false, false, false,
   'Any element required in the template (e.g. logos). Please provide file links for any required elements. If irrelevant, put N/A.'),
  ('Marketing Print and Digital Publications', 4, 'Design pegs/graphics', 'long_text', '[]', false, false, false,
   'You may suggest a specific design or provide links to existing assets. If irrelevant, put N/A.'),
  ('Marketing Print and Digital Publications', 5, 'Other important information', 'long_text', '[]', false, false, false,
   'If irrelevant, put N/A.'),

  -- 6.10 New Merchandise Design
  ('New Merchandise Design', 1, 'Type of merchandise material', 'single_select',
   '["Shirt", "Stickers", "Totebag", "Cap", "ID lace", "Notebook", "Ballpen"]',
   true, true, true,
   'ONE form per merchandise type. Kindly fill up a separate form for another merchandise design request.'),
  ('New Merchandise Design', 2, 'Detailed information about the material', 'long_text', '[]', false, true, false,
   'Place information about the requested material (e.g. dimensions, design and print specifications, etc.)'),
  ('New Merchandise Design', 3, 'Mandatory graphics', 'long_text', '[]', false, false, false,
   'Any element required in the template (e.g. logos). Please provide file links for any required elements. If irrelevant, put N/A.'),
  ('New Merchandise Design', 4, 'Design pegs/graphics', 'long_text', '[]', false, false, false,
   'You may suggest a specific design or provide links to existing assets. If irrelevant, put N/A.'),
  ('New Merchandise Design', 5, 'Other important information', 'long_text', '[]', false, false, false,
   'If irrelevant, put N/A.'),

  -- 6.11 Others / Stratpoint Initiatives (no ★ question: Output Needed shows "Others")
  ('Others / Stratpoint Initiatives', 1, 'Project Overview and Objective', 'long_text', '[]', false, true, false,
   'Please provide a brief background of the project, its purpose, and the objective you want to achieve. This will help the Designers better understand the context and direction of your request.'),
  ('Others / Stratpoint Initiatives', 2, 'Detailed information about the material', 'long_text', '[]', false, true, false,
   'Place information about the requested material (e.g. dimensions for the platform, design and print specifications, etc.)'),
  ('Others / Stratpoint Initiatives', 3, 'Copy', 'long_text', '[]', false, true, false,
   'Place detailed text content or link to the document/slides file.'),
  ('Others / Stratpoint Initiatives', 4, 'Mandatory graphics', 'long_text', '[]', false, false, false,
   'Any element required in the template (e.g. logos). Please provide file links for any required elements. If irrelevant, put N/A.'),
  ('Others / Stratpoint Initiatives', 5, 'Design pegs/graphics', 'long_text', '[]', false, false, false,
   'You may suggest a specific design or provide links to existing assets. If irrelevant, put N/A.'),
  ('Others / Stratpoint Initiatives', 6, 'Other important information', 'long_text', '[]', false, false, false,
   'If irrelevant, put N/A.')
) as q (type_name, sort_order, label, field_type, options, allow_other, required, is_output_needed, help_text)
join public.request_types t on t.name = q.type_name;
