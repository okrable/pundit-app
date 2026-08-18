SELECT
  (SELECT COUNT(*) FROM user_achievements) AS unlocked_achievements,
  (SELECT COUNT(*) FROM user_achievement_progress) AS progress_rows,
  (SELECT COUNT(*) FROM achievement_sync_receipts) AS applied_events;

SELECT achievement_id, COUNT(*) AS unlocks
FROM user_achievements
GROUP BY achievement_id
ORDER BY achievement_id;
