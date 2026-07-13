// PURPOSE: Mongoose schemas (MongoDB collections) for favorites-service.
//
// WHAT THIS FILE DOES:
//   1. Favorite          -> one favorite team per user (unique userId+team)
//   2. PredictionHistory -> every prediction a user made (with probabilities)
//   3. MatchAccuracy     -> one row per real match: model prediction vs result
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

// One row per real match: what the model predicted vs the actual result.
const matchAccuracySchema = new mongoose.Schema(
  {
    matchId: { type: Number, required: true, unique: true },
    homeTeam: { type: String, required: true },
    awayTeam: { type: String, required: true },
    stage: { type: String },
    homeScore: { type: Number },
    awayScore: { type: Number },
    actualResult: { type: String }, // home_win / draw / away_win
    predictedResult: { type: String },
    correct: { type: Boolean },
    probabilities: { type: Object },
    playedAt: { type: Date },
  },
  { timestamps: true }
);

export const Favorite = mongoose.model("Favorite", favoriteSchema);
export const PredictionHistory = mongoose.model(
  "PredictionHistory",
  predictionHistorySchema
);
export const MatchAccuracy = mongoose.model("MatchAccuracy", matchAccuracySchema);
