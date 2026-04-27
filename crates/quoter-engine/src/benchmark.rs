//! Benchmarking utilities for the price quoter

use std::collections::HashMap;
use std::time::{Duration, Instant};

/// Simple benchmark tracker
#[derive(Debug, Default)]
pub struct Benchmark {
    operations: HashMap<String, Vec<Duration>>,
}

impl Benchmark {
    /// Create a new benchmark tracker
    pub fn new() -> Self {
        Self::default()
    }

    /// Time an operation and record its duration
    pub fn time_operation<T, F>(&mut self, name: &str, operation: F) -> T
    where
        F: FnOnce() -> T,
    {
        let start = Instant::now();
        let result = operation();
        let duration = start.elapsed();

        self.operations
            .entry(name.to_string())
            .or_default()
            .push(duration);

        result
    }

    /// Get average duration for an operation
    pub fn average_duration(&self, name: &str) -> Option<Duration> {
        let durations = self.operations.get(name)?;
        if durations.is_empty() {
            return None;
        }

        let total_nanos: u64 = durations.iter().map(|d| d.as_nanos() as u64).sum();
        let avg_nanos = total_nanos / durations.len() as u64;

        Some(Duration::from_nanos(avg_nanos))
    }

    /// Get operation count
    pub fn operation_count(&self, name: &str) -> usize {
        self.operations.get(name).map_or(0, |v| v.len())
    }

    /// Print benchmark summary
    pub fn print_summary(&self) {
        println!("=== Benchmark Summary ===");
        for (name, durations) in &self.operations {
            if let Some(avg) = self.average_duration(name) {
                println!("{}: {} operations, avg: {:?}", name, durations.len(), avg);
            }
        }
    }

    /// Clear all benchmark data
    pub fn clear(&mut self) {
        self.operations.clear();
    }
}
