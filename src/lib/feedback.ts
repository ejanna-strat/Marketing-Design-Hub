// Feedback form wording (CLAUDE.md §9) and rating helpers.

export const FEEDBACK_COPY = {
  title: "Marketing Design Request Feedback",
  intro:
    "We'd love to know how we did! Your feedback helps us improve our design process and the outputs we deliver. Please submit a separate feedback form for each design output you received.",
  process: {
    heading: "Design Request Process",
    question:
      "How would you rate your overall experience with the design request process, from submitting the request and communicating with the team to receiving the final output?",
    levels: [
      "The process was difficult or unclear, with significant issues in communication or coordination.",
      "The process had several challenges that affected the experience.",
      "The process was generally okay, with some areas that could be improved.",
      "The process was smooth and easy to navigate, with only minor issues.",
      "The process was smooth, clear, and easy from request to delivery.",
    ],
  },
  output: {
    heading: "Design Output",
    question: "How would you rate the overall quality and usefulness of the design output you received?",
    levels: [
      "The output did not meet the intended purpose and required significant improvement.",
      "The output had several areas that needed improvement.",
      "The output was generally usable but had some areas that could be improved.",
      "The output was effective and met most of the intended needs.",
      "The output was effective, well-executed, and served its intended purpose well.",
    ],
  },
  comments: {
    heading: "Additional Comments (optional)",
    question:
      "Do you have any feedback or suggestions about the design request process or the output itself? Share what worked well, what could be improved, or anything you'd like the Marketing Design team to know. You can write your comments in English or Filipino.",
  },
  thanks:
    "Thank you for your feedback! We really appreciate you taking the time to share your thoughts with us. If you have other design outputs you'd like to share feedback on, you may submit another feedback form.",
} as const;

// Overall feedback for one request = (process + output) ÷ 2, e.g. 4.5.
export function overallRating(f: { process_rating: number; output_rating: number }) {
  return (f.process_rating + f.output_rating) / 2;
}

// "4.5" / "4" for display.
export function formatRating(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

// A one-to-one embed may come back as an object, an array or null.
export function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}
