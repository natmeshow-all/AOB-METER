---
name: grill-me
description: "Relentlessly interview the user about a plan, design, or architecture to stress-test it and resolve all branches of the decision tree. Use when user presents an idea, plan, feature proposal, asks to stress-test a design, or whenever starting a non-trivial new design or architectural task."
---

# Grill-Me: Relentless Requirements & Architecture Interviewer

## Purpose
Interview the user relentlessly about every aspect of their plan, feature, or design until reaching complete shared understanding. Walk down each branch of the decision tree, resolving dependencies between decisions one-by-one. Never guess or write code on unstated assumptions.

## Core Protocol
1. **One Question at a Time:**
   - Never overwhelm the user with a bulleted list of 5 questions.
   - Ask a single focused question per turn.
   - For each question, provide your recommended answer first (e.g. `(Recommended) ...`) along with distinct options.
   - Use the `ask_question` tool whenever multiple-choice options can be presented cleanly.

2. **Decision-Tree Walking:**
   - Map out the major branches: User Experience, Data Models, State Management, API & Auth, Error & Edge Cases, Performance & Scalability.
   - Probe the frontier: ask the question whose answer determines the subsequent decisions.
   - Dive deep down a branch until resolved before backtracking to sibling branches.

3. **Codebase-First Exploration:**
   - Before asking a question that might already be settled by existing code, schemas, or conventions, explore the codebase first.
   - Only ask questions about genuine design decisions, product requirements, or trade-offs.

4. **Objective & Direct:**
   - Avoid performative flattery or superficial validation.
   - Challenge unstated assumptions, failure modes, scale bottlenecks, and security implications directly.

5. **Exit Criteria:**
   - When all critical branches are resolved, summarize the finalized design into a concrete, executable plan (or handover to `writing-plans` / `executing-plans`).
