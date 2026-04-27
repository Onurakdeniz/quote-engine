//! Output formatting and serialization utilities

use crate::engine::quoting::PriceQuote;
use std::io::Write;

/// Output format options
#[derive(Debug, Clone, Copy)]
pub enum OutputFormat {
    Json,
    Csv,
    Table,
}

/// Output formatter for price quotes
pub struct OutputFormatter;

impl OutputFormatter {
    /// Format a price quote to the specified format
    pub fn format_quote(
        quote: &PriceQuote,
        format: OutputFormat,
    ) -> Result<String, Box<dyn std::error::Error>> {
        match format {
            OutputFormat::Json => Self::format_json(quote),
            OutputFormat::Csv => Self::format_csv(quote),
            OutputFormat::Table => Self::format_table(quote),
        }
    }

    /// Format as JSON
    fn format_json(quote: &PriceQuote) -> Result<String, Box<dyn std::error::Error>> {
        Ok(serde_json::to_string_pretty(quote)?)
    }

    /// Format as CSV
    fn format_csv(quote: &PriceQuote) -> Result<String, Box<dyn std::error::Error>> {
        let mut output = String::new();
        output.push_str(
            "amount_out,route,price_impact_bps,mid_price,slippage_bps,fee_bps,gas_estimate\n",
        );

        let amount_out = quote
            .amount_out
            .map_or("None".to_string(), |v| v.to_string());
        let route = quote
            .route
            .iter()
            .map(|addr| format!("0x{}", hex::encode(addr.as_ref())))
            .collect::<Vec<_>>()
            .join(";");
        let price_impact = quote
            .price_impact_bps
            .map_or("None".to_string(), |v| v.to_string());
        let mid_price = quote
            .mid_price
            .map_or("None".to_string(), |v| v.to_string());
        let slippage = quote
            .slippage_bps
            .map_or("None".to_string(), |v| v.to_string());
        let fee = quote.fee_bps.map_or("None".to_string(), |v| v.to_string());
        let gas = quote
            .gas_estimate
            .map_or("None".to_string(), |v| v.to_string());

        output.push_str(&format!(
            "{},{},{},{},{},{},{}\n",
            amount_out, route, price_impact, mid_price, slippage, fee, gas
        ));

        Ok(output)
    }

    /// Format as table
    fn format_table(quote: &PriceQuote) -> Result<String, Box<dyn std::error::Error>> {
        let mut output = String::new();
        output.push_str("╭─────────────────────────────────────────────────────────────────╮\n");
        output.push_str("│                        Price Quote                              │\n");
        output.push_str("├─────────────────────────────────────────────────────────────────┤\n");

        if let Some(amount_out) = quote.amount_out {
            output.push_str(&format!("│ Amount Out: {:>48} │\n", amount_out));
        }

        if let Some(mid_price) = &quote.mid_price {
            output.push_str(&format!("│ Mid Price: {:>49} │\n", mid_price));
        }

        if let Some(slippage) = &quote.slippage_bps {
            output.push_str(&format!("│ Slippage (bps): {:>44} │\n", slippage));
        }

        if let Some(fee) = &quote.fee_bps {
            output.push_str(&format!("│ Fee (bps): {:>47} │\n", fee));
        }

        if let Some(gas) = quote.gas_estimate {
            output.push_str(&format!("│ Gas Estimate: {:>46} │\n", gas));
        }

        if !quote.route.is_empty() {
            output
                .push_str("├─────────────────────────────────────────────────────────────────┤\n");
            output
                .push_str("│ Route:                                                          │\n");
            for (i, token) in quote.route.iter().enumerate() {
                let token_str = format!("0x{}", hex::encode(token.as_ref()));
                output.push_str(&format!(
                    "│ {}: {:>55} │\n",
                    i + 1,
                    if token_str.len() > 55 {
                        format!("{}...", &token_str[..52])
                    } else {
                        token_str
                    }
                ));
            }
        }

        output.push_str("╰─────────────────────────────────────────────────────────────────╯\n");

        Ok(output)
    }

    /// Write output to a writer
    pub fn write_output<W: Write>(
        writer: &mut W,
        quote: &PriceQuote,
        format: OutputFormat,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let formatted = Self::format_quote(quote, format)?;
        writer.write_all(formatted.as_bytes())?;
        Ok(())
    }
}
