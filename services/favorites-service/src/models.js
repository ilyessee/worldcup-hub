import mongoose from "mongoose";

const favoriteSchema = new mongoose.Schema(
  {
    userId: { type: Number, required: true, index: true },
    team: { type: String, required: true },
  },
  { timestamps: true }
);
favoriteSchema.index({ userId: 1, team: 1 }, { unique: true });

const predictionHistorySchema = new mongoose.Schema(
  {
    userId: { type: Number, required: true, index: true },
    homeTeam: { type: String, required: true },
    awayTeam: { type: String, required: true },
    stage: { type: String, default: "GROUP_STAGE" },
    prediction: { type: String },
    probabilities: { type: Object },
  },
  { timestamps: true }
);

export const Favorite = mongoose.model("Favorite", favoriteSchema);
export const PredictionHistory = mongoose.model(
  "PredictionHistory",
  predictionHistorySchema
);
