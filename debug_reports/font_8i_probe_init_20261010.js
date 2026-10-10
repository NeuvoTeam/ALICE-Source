// ALICE card 8i - measurement harness init script (injected before any app JS runs).
// Stubs the two Worker calls the review page makes with synthetic, non-PHI data so the
// page's .font-mono consumers render without a live backend or a credential.
(function () {
  var BUNDLE = {
    submission: {
      id: "11111111-1111-4111-8111-111111111111",
      client_id: "22222222-2222-4222-8222-222222222222",
      practitioner_id: "66666666-6666-4666-8666-666666666666",
      task_type: "activity_log",
      form_data: {
        task_type: "activity_log",
        activity_date: "2026-10-05",
        activity_description: JSON.stringify({
          Mon: {
            "09:00": { activity: "Walked the dog", moodRating: 6 },
            "14:00": { activity: "Gardening", moodRating: 7 }
          },
          Wed: {
            "11:00": { activity: "Reading", moodRating: 5 }
          }
        }),
        pleasure_rating: 6,
        mastery_rating: 7,
        notes: "Synthetic probe row."
      },
      status: "approved",
      // +11h offset so fmtDate renders the same local wall-clock strings as rank 8b.
      reviewed_at: "2026-10-08T06:07:00.000Z",
      created_at: "2026-10-06T02:03:00.000Z",
      updated_at: "2026-10-08T06:07:00.000Z"
    },
    reflections: [],
    practitioner_notes: [
      {
        id: "77777777-7777-4777-8777-777777777777",
        submission_id: "11111111-1111-4111-8111-111111111111",
        practitioner_id: "33333333-3333-4333-8333-333333333333",
        notes: "Synthetic probe note.",
        created_at: "2026-10-06T04:05:00.000Z"
      }
    ],
    audit_log: [
      {
        id: "88888888-8888-4888-8888-888888888881",
        submission_id: "11111111-1111-4111-8111-111111111111",
        previous_status: "draft",
        new_status: "pending_practitioner_review",
        changed_by_user_id: "44444444-4444-4444-8444-444444444444",
        changed_at: "2026-10-06T02:03:00.000Z"
      },
      {
        id: "88888888-8888-4888-8888-888888888882",
        submission_id: "11111111-1111-4111-8111-111111111111",
        previous_status: "pending_practitioner_review",
        new_status: "reviewed",
        changed_by_user_id: "33333333-3333-4333-8333-333333333333",
        changed_at: "2026-10-07T00:10:00.000Z"
      },
      {
        id: "88888888-8888-4888-8888-888888888883",
        submission_id: "11111111-1111-4111-8111-111111111111",
        previous_status: "reviewed",
        new_status: "approved",
        changed_by_user_id: "55555555-5555-4555-8555-555555555555",
        changed_at: "2026-10-08T06:07:00.000Z"
      }
    ]
  };

  var calls = [];
  window.__probeCalls = calls;

  function json(body, status) {
    return new Response(JSON.stringify(body), {
      status: status || 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  var realmFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url =
      typeof input === "string"
        ? input
        : (input && input.url) || String(input);
    if (url.indexOf("/auth/me") !== -1) {
      calls.push(url);
      return Promise.resolve(
        json({ id: "99999999-9999-4999-8999-999999999999", email: "probe@example.invalid" })
      );
    }
    if (url.indexOf("/client-homework/") !== -1) {
      calls.push(url);
      return Promise.resolve(
        json({
          sessionId: "probe-session",
          title: "Probe Session",
          practiceHomework: [],
          practiceTask: {
            task_type: "reflection_prompt",
            prompt: "Synthetic probe reflection prompt."
          }
        })
      );
    }
    if (url.indexOf("/bundle") !== -1) {
      calls.push(url);
      return Promise.resolve(json(BUNDLE));
    }
    return realmFetch(input, init);
  };

  try {
    localStorage.setItem("alice_token", "probe-token");
  } catch (e) {}
})();
